import { Grid } from "../grid";
import { BoolArray2DRow } from "../helpers/datastructures";

import { RuleNode } from "./";

export class ParallelNode extends RuleNode {
    private newstate: Uint8Array;

    protected override async load(
        elem: Element,
        parentSymmetry: Uint8Array,
        grid: Grid
    ) {
        if (!(await super.load(elem, parentSymmetry, grid))) return false;
        this.newstate = new Uint8Array(grid.state.length);
        return true;
    }

    protected override add(
        r: number,
        x: number,
        y: number,
        z: number,
        maskr: BoolArray2DRow
    ): void {
        const ip = this.ip;
        const grid = this.grid;

        const rule = this.rules[r];
        if (ip.rng.double() > rule.p) return;
        this.last[r] = 1;
        const { MX, MY } = grid;

        for (let dz = 0; dz < rule.OMZ; dz++)
            for (let dy = 0; dy < rule.OMY; dy++)
                for (let dx = 0; dx < rule.OMX; dx++) {
                    const newvalue =
                        rule.output[
                            dx + dy * rule.OMX + dz * rule.OMX * rule.OMY
                        ];
                    let idi = x + dx + (y + dy) * MX + (z + dz) * MX * MY;
                    if (newvalue != 0xff && newvalue != grid.state[idi]) {
                        this.newstate[idi] = newvalue;
                        ip.changes.push([x + dx, y + dy, z + dz]);
                    }
                }
        this.matchCount++;
    }

    public override run(): boolean {
        if (!super.run()) return false;

        const { ip, grid, newstate } = this;

        for (let n = ip.first[ip.counter]; n < ip.changes.length; n++) {
            const [x, y, z] = ip.changes[n];
            let i = x + y * grid.MX + z * grid.MX * grid.MY;
            grid.state[i] = newstate[i];
        }

        this.counter++;
        return this.matchCount > 0;
    }
}
