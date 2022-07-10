import { Rule } from "../rule";

import bool_2d_src from "./bin/bool_2d.as";
import common_src from "./bin/common.as";
import obs_src from "./bin/observation.as";
import queue_src from "./bin/queue.as";
import potential_src from "./bin/potential.as";
import { vec3 } from "gl-matrix";
import { WasmModule } from ".";

try {
    asc;

    window.ascLoadPromise = Promise.resolve();
} catch (_) {
    window.ascLoadPromise = new Promise(
        (resolve) => (window.ascLoadResolve = resolve)
    );
}

const rule_match = (rule: Rule, r: number, bd: boolean) => {
    const d = bd ? "bd" : "fd";
    const a = bd ? rule.output : rule.binput;
    const [IMX, IMY] = rule.IO_DIM;

    return `
@inline
function rule_match_${r}_${d}(x: i32, y: i32, z: i32, 
    p: potential_t, t: i32, MX: u32, MY: u32) : bool {
        
    let dz = 0,
        dy = 0,
        dx = 0;
    ${[...a]
        .map(
            (value) => `
    ${
        value !== 0xff
            ? `
    {
        const current = potential_get(p, 
            u32(x + dx + (y + dy) * MX + (z + dz) * MX * MY), ${value});
        if (current > t || current === -1) return false;
    }
    `
            : ""
    }
    dx++;
    if (dx === ${IMX}) {
        dx = 0;
        dy++;
        if (dy === ${IMY}) {
            dy = 0;
            dz++;
        }
    }
    `
        )
        .join("")}
    return true;
}
    `;
};

const rule_apply = (rule: Rule, r: number, bd: boolean) => {
    const d = bd ? "bd" : "fd";
    const a = bd ? rule.binput : rule.output;
    const [IMX, IMY, IMZ] = rule.IO_DIM;

    return `
@inline
function rule_apply_${r}_${d}(x: i32, y: i32, z: i32, 
    p: potential_t, t: i32, MX: u32, MY: u32, q: queue_t) : void {
    
    ${Array.from(
        { length: IMZ },
        (_, dz) => `
    {
        const zdz = z + ${dz};
        ${Array.from(
            { length: IMY },
            (_, dy) => `
        {
            const ydy = y + ${dy};
            ${Array.from({ length: IMX }, (_, dx) => {
                const di = dx + dy * IMX + dz * IMX * IMY;
                const o = a[di];
                return o !== 0xff
                    ? `
            {
                const xdx = x + ${dx};
                const idi = xdx + ydy * MX + zdz * MX * MY;
                if (potential_get(p, idi, ${o}) === -1) {
                    potential_set(p, idi, ${o}, t + 1);
                    push_vec(q, ${o}, xdx, ydy, zdz);
                }
            }`
                    : "";
            }).join("")}
        }`
        ).join("")}
    }`
    ).join("")}
}`;
};

const unroll_rule = (rule: Rule, r: number, bd: boolean) => {
    const d = bd ? "bd" : "fd";
    const shifts = bd ? rule.oshifts : rule.ishifts;
    const [IMX, IMY, IMZ] = rule.IO_DIM;

    const values: number[] = [];
    for (let i = 0; i < shifts.length; i++) {
        if (shifts[i].length) values.push(i);
    }

    const unroll_case = (value: number, shift: vec3[]) => {
        const unroll_shift = (p: vec3) => {
            return `
                {
                    const sx = i32(x) - ${p[0]};
                    const sy = i32(y) - ${p[1]};
                    const sz = i32(z) - ${p[2]};

                    if (sx >= 0 && sy >= 0 && sz >= 0 && 
                        sx + ${IMX} <= i32(MX) && sy + ${IMY} <= i32(MY) && sz + ${IMZ} <= i32(MZ)) {
                        
                        const si = sx + sy * MX + sz * MX * MY;

                        if (!bool_2d_get(mask, si, ${r}) && 
                            rule_match_${r}_${d}(sx, sy, sz, p, t, MX, MY)) {
                            ${bd ? `log_rule_match(${r}, sx, sy, sz);` : ""}
                            bool_2d_set(mask, si, ${r}, true);
                            rule_apply_${r}_${d}(sx, sy, sz, p, t, MX, MY, q);
                        }
                    }
                }
                `;
        };

        return `
            case ${value}: {${shift.map(unroll_shift).join("")}
                break;
            }`;
    };

    return `
        switch (value) {${values.map((v) => unroll_case(v, shifts[v])).join("")}
        }
    `;
};

const child_state = (rule: Rule, r: number) => {
    const [IMX, IMY, IMZ] = rule.IO_DIM;
    const input = [...rule.input];
    const output = rule.output;

    return `
export function child_state_${r}(parent: usize, child: usize, x: u32, y: u32, MX: u32, MY: u32) : bool {
    if (x + ${IMX} > MX || y + ${IMY} > MY) return false;

    let dy: u32 = 0,
        dx: u32 = 0;
    ${input
        .map(
            (v) => `
    {
        const v = load<u8>(parent + (x + dx + (y + dy) * MX));
        if (${v} & v === 0) return false;
        dx++;
        if (dx === ${IMX}) {
            dx = 0;
            dy++;
        }
    }`
        )
        .join("")}
    
    memory.copy(child, parent, MX * MY);
    ${Array.from(
        { length: IMZ },
        (_, dz) => `
    {
        ${Array.from(
            { length: IMY },
            (_, dy) => `
        {
            ${Array.from({ length: IMX }, (_, dx) => {
                const v = output[dx + dy * IMX + dz * IMX * IMY];
                return v !== 0xff
                    ? `
            store<u8>(child + x + ${dx} + (y + ${dy}) * MX, ${v});
            `
                    : "";
            }).join("")}
        }`
        ).join("")}
    }`
    ).join("")}

    return true;
}
`;
};

export class AssemblyScript {
    private static async load() {
        await window.ascLoadPromise;
    }

    public static async generate(rules: Rule[]) {
        await this.load();

        let buffer: Uint8Array;

        const start = performance.now();

        const funcs =
            rules
                .map(
                    (rule, r) =>
                        rule_match(rule, r, false) +
                        rule_match(rule, r, true) +
                        rule_apply(rule, r, false) +
                        rule_apply(rule, r, true)
                )
                .join("") +
            rules.map((rule, r) => child_state(rule, r)).join("");

        console.log(funcs);

        const unroll = rules
            .map(
                (rule, r) => `
        if (is_bd) {${unroll_rule(rule, r, true)}
        } else {${unroll_rule(rule, r, false)}
        }`
            )
            .join("");

        const obs_src_jit = obs_src
            .replace("/*functions*/", funcs)
            .replace("/*unroll*/", unroll);

        const hash = (~~(Math.random() * Number.MAX_SAFE_INTEGER))
            .toString(36)
            .slice(0, 12);
        const filename = `generated[${hash}].wasm`;
        const sourceMap = `generated[${hash}].wasm.map`;
        const { error, stderr } = await asc.main(
            [
                "obs.ts",
                "-Ospeed",
                "-Osize",
                "--noAssert",
                "--optimizeLevel=3",
                "--converge",
                "--importMemory",
                // `--sourceMap=http://localhost:6969/${sourceMap}`,
                "-o",
                filename,
            ],
            {
                readFile: (f, _) => {
                    return {
                        "obs.ts": obs_src_jit,
                        "bool_2d.ts": bool_2d_src,
                        "queue.ts": queue_src,
                        "common.ts": common_src,
                        "potential.ts": potential_src,
                    }[f];
                },
                writeFile: async (name, buf) => {
                    if (name === filename) buffer = buf;
                    else if (name === sourceMap) {
                        // saveAs(new Blob([buf]), name);
                        // await new Promise((resolve) =>
                        //     setTimeout(resolve, 5000)
                        // );
                    }
                },
                listFiles: () => [],
            }
        );

        if (error) {
            console.error(error);
            console.error(stderr.toString());
        }

        if (buffer) {
            const wm = await WasmModule.load(buffer);
            const wi = await wm.init();

            const end = performance.now();
            console.log(
                `${(buffer.byteLength / 1024).toFixed(1)}kb`,
                (end - start).toFixed(2) + "ms"
            );

            return wi;
        } else return null;
    }
}
