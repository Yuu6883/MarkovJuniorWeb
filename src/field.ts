import { Grid } from "./grid";
import { Array2D } from "./helpers/datastructures";
import { vec3 } from "./helpers/helper";
import { Rule } from "./rule";

export class Field {
    public recompute: boolean;
    public inversed: boolean;
    public essential: boolean;

    public zero: number;
    public substrate: number;

    constructor(elem: Element, grid: Grid) {
        this.recompute = elem.getAttribute("recompute") === "True";
        this.essential = elem.getAttribute("essential") === "True";
        const on = elem.getAttribute("on");
        this.substrate = grid.wave(on);

        let zeroSymbols = elem.getAttribute("from");
        if (zeroSymbols) this.inversed = true;
        else zeroSymbols = elem.getAttribute("to");
        this.zero = grid.wave(zeroSymbols);
    }

    public compute(potential: Int32Array, grid: Grid) {
        const { MX, MY, MZ } = grid;
        const queue: [number, number, number, number][] = [];

        let ix = 0,
            iy = 0,
            iz = 0;
        for (let i = 0; i < grid.state.length; i++) {
            potential[i] = -1;
            const value = grid.state[i];
            if ((this.zero & (1 << value)) !== 0) {
                potential[i] = 0;
                queue.push([0, ix, iy, iz]);
            }

            ix++;
            if (ix === MX) {
                ix = 0;
                iy++;
                if (iy === MY) {
                    iy = 0;
                    iz++;
                }
            }
        }

        if (!queue.length) return false;
        while (queue.length) {
            const [t, x, y, z] = queue.shift();
            const neighbors = Field.neighbors(x, y, z, MX, MY, MZ);
            for (const [nx, ny, nz] of neighbors) {
                const i = nx + ny * MX + nz * MX * MY;
                const value = grid.state[i];
                if (
                    potential[value] === -1 &&
                    (this.substrate & (1 << value)) !== 0
                ) {
                    queue.push([t + 1, nx, ny, nz]);
                    potential[i] = t + 1;
                }
            }
        }

        return true;
    }

    static neighbors(
        x: number,
        y: number,
        z: number,
        MX: number,
        MY: number,
        MZ: number
    ) {
        const result: vec3[] = [];

        if (x > 0) result.push([x - 1, y, z]);
        if (x < MX - 1) result.push([x + 1, y, z]);
        if (y > 0) result.push([x, y - 1, z]);
        if (y < MY - 1) result.push([x, y + 1, z]);
        if (z > 0) result.push([x, y, z - 1]);
        if (z < MZ - 1) result.push([x, y, z + 1]);

        return result;
    }

    static deltaPointwise(
        state: Uint8Array,
        rule: Rule,
        x: number,
        y: number,
        z: number,
        fields: Field[],
        potentials: Array2D<Int32Array>,
        MX: number,
        MY: number
    ) {
        let sum = 0;
        let dz = 0,
            dy = 0,
            dx = 0;
        for (let di = 0; di < rule.input.length; di++) {
            const newValue = rule.output[di];
            if (newValue != 0xff && (rule.input[di] & (1 << newValue)) == 0) {
                let i = x + dx + (y + dy) * MX + (z + dz) * MX * MY;
                let newPotential = potentials.get(i, newValue);
                if (newPotential == -1) return null;

                const oldValue = state[i];
                let oldPotential = potentials.get(i, oldValue);
                sum += newPotential - oldPotential;

                if (fields != null) {
                    const oldField = fields[oldValue];
                    if (oldField != null && oldField.inversed)
                        sum += 2 * oldPotential;
                    const newField = fields[newValue];
                    if (newField != null && newField.inversed)
                        sum -= 2 * newPotential;
                }
            }

            dx++;
            if (dx == rule.IMX) {
                dx = 0;
                dy++;
                if (dy == rule.IMY) {
                    dy = 0;
                    dz++;
                }
            }
        }
        return sum;
    }
}