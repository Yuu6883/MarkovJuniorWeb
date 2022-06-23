import { Field } from "../field";
import { Grid } from "../grid";
import { BoolArray2D } from "../helpers/datastructures";
import { Helper } from "../helpers/helper";
import { RuleNode } from "./rule";

export class AllNode extends RuleNode {
    protected override async load(
        elem: Element,
        parentSymmetry: Uint8Array,
        grid: Grid
    ) {
        if (!super.load(elem, parentSymmetry, grid)) return false;
        this.matches = [];
        this.matchMask = new BoolArray2D(this.rules.length, grid.state.length);
        this.matchMask.clear();
        return true;
    }

    fit(
        r: number,
        x: number,
        y: number,
        z: number,
        newstate: Uint8Array,
        MX: number,
        MY: number
    ) {
        const rule = this.rules[r];
        for (let dz = 0; dz < rule.OMZ; dz++)
            for (let dy = 0; dy < rule.OMY; dy++)
                for (let dx = 0; dx < rule.OMX; dx++) {
                    const value =
                        rule.output[
                            dx + dy * rule.OMX + dz * rule.OMX * rule.OMY
                        ];
                    if (
                        value != 0xff &&
                        newstate[x + dx + (y + dy) * MX + (z + dz) * MX * MY]
                    )
                        return;
                }
        this.last[r] = 1;
        for (let dz = 0; dz < rule.OMZ; dz++)
            for (let dy = 0; dy < rule.OMY; dy++)
                for (let dx = 0; dx < rule.OMX; dx++) {
                    const newvalue =
                        rule.output[
                            dx + dy * rule.OMX + dz * rule.OMX * rule.OMY
                        ];
                    if (newvalue != 0xff) {
                        let sx = x + dx,
                            sy = y + dy,
                            sz = z + dz;
                        let i = sx + sy * MX + sz * MX * MY;
                        newstate[i] = 1;
                        this.grid.state[i] = newvalue;
                        this.ip.changes.push([sx, sy, sz]);
                    }
                }
    }

    public override run(): boolean {
        const grid = this.grid;
        if (!super.run()) return false;
        this.lastMatchedTurn = this.ip.counter;

        if (this.trajectory) {
            if (this.counter >= this.trajectory.ROWS) return false;
            grid.state.set(this.trajectory.row(this.counter));
            this.counter++;
            return true;
        }

        if (!this.matchCount) return false;
        const { MX, MY } = grid;

        if (this.potentials) {
            let firstHeuristic = 0;
            let firstHeuristicComputed = false;

            const list: [number, number][] = [];
            for (let m = 0; m < this.matchCount; m++) {
                const [r, x, y, z] = this.matches[m];
                const heuristic = Field.deltaPointwise(
                    grid.state,
                    this.rules[r],
                    x,
                    y,
                    z,
                    this.fields,
                    this.potentials,
                    MX,
                    MY
                );
                if (heuristic !== null) {
                    if (!firstHeuristicComputed) {
                        firstHeuristic = heuristic;
                        firstHeuristicComputed = true;
                    }
                    const u = this.ip.rng.double();
                    list.push([
                        m,
                        this.temperature > 0
                            ? Math.pow(
                                  u,
                                  Math.exp(
                                      (heuristic - firstHeuristic) /
                                          this.temperature
                                  )
                              )
                            : -heuristic + 0.001 * u,
                    ]);
                }
            }
            list.sort(([, a], [, b]) => b - a);
            for (const [k, _] of list) {
                const [r, x, y, z] = this.matches[k];
                this.matchMask.set(x + y * MX + z * MX * MY, r, false);
                this.fit(r, x, y, z, grid.mask, MX, MY);
            }
        } else {
            const shuffle = new Int32Array(this.matchCount);
            Helper.shuffleFill(shuffle, this.ip.rng);
            for (const k of shuffle) {
                const [r, x, y, z] = this.matches[k];
                this.matchMask.set(x + y * MX + z * MX * MY, r, false);
                this.fit(r, x, y, z, grid.mask, MX, MY);
            }
        }

        for (
            let n = this.ip.first[this.lastMatchedTurn];
            n < this.ip.changes.length;
            n++
        ) {
            const [x, y, z] = this.ip.changes[n];
            grid.mask[x + y * MX + z * MX * MY] = 0;
        }
        this.counter++;
        this.matchCount = 0;
        return true;
    }
}
