import { Rule } from "../rule";

import bool_2d_src from "./bin/bool_2d.as";
import common_src from "./bin/common.as";
import obs_src from "./bin/observation.as";
import queue_src from "./bin/queue.as";
import potential_src from "./bin/potential.as";

try {
    asc;

    window.ascLoadPromise = Promise.resolve();
} catch (_) {
    window.ascLoadPromise = new Promise(
        (resolve) => (window.ascLoadResolve = resolve)
    );
}

export class AssemblyScript {
    private static async load() {
        await window.ascLoadPromise;
    }

    public static async generate(rules: Rule[]) {
        await this.load();

        let buffer: Uint8Array;

        const start = performance.now();
        const { error, stderr, stdout } = await asc.main(
            [
                "obs.ts",
                "-O3",
                "--noAssert",
                "--importMemory",
                "-o",
                "generated.wasm",
            ],
            {
                readFile: (f, _) => {
                    return {
                        "obs.ts": obs_src,
                        "bool_2d.ts": bool_2d_src,
                        "queue.ts": queue_src,
                        "common.ts": common_src,
                        "potential.ts": potential_src,
                    }[f];
                },
                writeFile: (_, buf) => void (buffer = buf),
                listFiles: () => [],
            }
        );
        const end = performance.now();
        console.log(buffer, (end - start).toFixed(2) + "ms");
    }
}
