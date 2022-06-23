import { PRNG } from "seedrandom";
import { Field } from "../field";
import { Grid } from "../grid";
import { BoolArray2D } from "../helpers/datastructures";
import { range } from "../helpers/helper";
import { Observation } from "../observation";
import { Rule } from "../rule";

import { RuleNode } from "./";

export class OneNode extends RuleNode {
    protected override async load(
        elem: Element,
        parentSymmetry: Uint8Array,
        grid: Grid
    ) {
        if (!(await super.load(elem, parentSymmetry, grid))) return false;
        this.matches = [];
        this.matchMask = new BoolArray2D(this.rules.length, grid.state.length);
        this.matchMask.clear();
        return true;
    }

    public override reset(): void {
        super.reset();
        if (this.matchCount) {
            this.matchMask.clear();
            this.matchCount = 0;
        }
    }

    public apply(rule: Rule, x: number, y: number, z: number) {
        // console.log(`Applying rule`);

        const grid = this.grid;
        const { MX, MY } = grid;
        const changes = this.ip.changes;

        for (let dz = 0; dz < rule.OMZ; dz++)
            for (let dy = 0; dy < rule.OMY; dy++)
                for (let dx = 0; dx < rule.OMX; dx++) {
                    const newValue =
                        rule.output[
                            dx + dy * rule.OMX + dz * rule.OMX * rule.OMY
                        ];
                    if (newValue !== 0xff) {
                        const sx = x + dx;
                        const sy = y + dy;
                        const sz = z + dz;
                        const si = sx + sy * MX + sz * MX * MY;
                        const oldValue = grid.state[si];
                        if (newValue !== oldValue) {
                            grid.state[si] = newValue;
                            changes.push([sx, sy, sz]);
                            // console.log(`[${[sx, sy, sz].join(", ")}]`);
                        }
                    }
                }
    }

    public override run(): boolean {
        if (!super.run()) return false;
        this.lastMatchedTurn = this.ip.counter;

        if (this.trajectory) {
            console.log(`OneNode.run [${this.ip.counter}]: trajectory = true`);

            if (this.counter >= this.trajectory.ROWS) return false;
            this.grid.state.set(this.trajectory.row(this.counter));
            this.counter++;
            return true;
        }

        const [R, X, Y, Z] = this.randomMatch(this.ip.rng);
        if (R < 0) return false;
        else {
            this.last[R] = 1;
            this.apply(this.rules[R], X, Y, Z);
            this.counter++;
            return true;
        }
    }

    randomMatch(rng: PRNG): [number, number, number, number] {
        const grid = this.grid;

        if (this.potentials) {
            if (
                this.observations &&
                Observation.IsGoalReached(grid.state, this.future)
            ) {
                this.futureComputed = false;
                return [-1, -1, -1, -1];
            }
            let max = -1000;
            let argmax = -1;

            let firstHeuristic = 0;
            let firstHeuristicComputed = false;

            for (let k = 0; k < this.matchCount; k++) {
                const [r, x, y, z] = this.matches[k];
                let i = x + y * grid.MX + z * grid.MX * grid.MY;
                if (!grid.matches(this.rules[r], x, y, z)) {
                    this.matchMask.set(i, r, false);
                    this.matches[k] = this.matches[this.matchCount - 1];
                    this.matchCount--;
                    k--;
                } else {
                    const heuristic = Field.deltaPointwise(
                        grid.state,
                        this.rules[r],
                        x,
                        y,
                        z,
                        this.fields,
                        this.potentials,
                        grid.MX,
                        grid.MY
                    );
                    if (heuristic === null) continue;
                    if (!firstHeuristicComputed) {
                        firstHeuristic = heuristic;
                        firstHeuristicComputed = true;
                    }
                    const u = rng.double();
                    const key =
                        this.temperature > 0
                            ? Math.pow(
                                  u,
                                  Math.exp(
                                      (heuristic - firstHeuristic) /
                                          this.temperature
                                  )
                              )
                            : -heuristic + 0.001 * u;
                    if (key > max) {
                        max = key;
                        argmax = k;
                    }
                }
            }
            return argmax >= 0 ? this.matches[argmax] : [-1, -1, -1, -1];
        } else {
            while (this.matchCount > 0) {
                const matchIndex = range(rng, this.matchCount);

                const [r, x, y, z] = this.matches[matchIndex];
                let i = x + y * grid.MX + z * grid.MX * grid.MY;

                this.matchMask.set(i, r, false);
                this.matches[matchIndex] = this.matches[this.matchCount - 1];
                this.matchCount--;

                // console.log(
                //     `Trying [${x}, ${y}, ${z}] matches: ${this.matchCount} index: ${matchIndex}`
                // );
                if (grid.matches(this.rules[r], x, y, z)) return [r, x, y, z];
            }
            return [-1, -1, -1, -1];
        }
    }
}
