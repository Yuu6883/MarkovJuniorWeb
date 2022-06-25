import { Field } from "../field";
import { Grid } from "../grid";
import {
    Array2D,
    BoolArray2D,
    BoolArray2DRow,
} from "../helpers/datastructures";
import { Helper } from "../helpers/helper";
import { SymmetryHelper } from "../helpers/symmetry";
import { Observation } from "../observation";
import { Rule } from "../rule";
import { Search } from "../search";

import { Node, AllNode } from "./";

export abstract class RuleNode extends Node {
    public rules: Rule[];
    public counter: number;
    public steps: number;

    public matches: Uint32Array;
    public matchCount: number;
    protected lastMatchedTurn: number;
    protected matchMask: BoolArray2D;

    protected potentials: Array2D<Int32Array>;
    public fields: Field[];
    protected observations: Observation[];
    protected temperature: number;

    protected search: boolean;
    protected futureComputed: boolean;
    protected future: Int32Array;
    protected trajectory: Array2D<Uint8Array>; // TODO: maybe not array2d

    private limit: number;
    private depthCoefficient: number;

    public last: Uint8Array;

    protected override async load(
        elem: Element,
        parentSymmetry: Uint8Array,
        grid: Grid
    ) {
        const symmetryString = elem.getAttribute("symmetry");
        const symmetry = SymmetryHelper.getSymmetry(
            grid.MZ === 1,
            symmetryString,
            parentSymmetry
        );
        if (!symmetry) {
            console.error(elem, `unknown symmetry ${symmetryString}`);
            return null;
        }

        const ruleList: Rule[] = [];
        const rules = Helper.collectionToArr(elem.getElementsByTagName("rule"));
        const ruleElements = rules.length > 0 ? rules : [elem];
        for (const e of ruleElements) {
            const rule = await Rule.load(e, grid, grid);
            if (!rule) return false;
            rule.original = true;

            const ruleSymmetryString = e.getAttribute("symmetry");
            const ruleSymmetry = SymmetryHelper.getSymmetry(
                grid.MZ === 1,
                ruleSymmetryString,
                symmetry
            );
            if (!ruleSymmetry) {
                console.error(e, `unknown rule symmetry ${ruleSymmetryString}`);
                return null;
            }
            for (const r of rule.symmetries(ruleSymmetry, grid.MZ === 1))
                ruleList.push(r);

            // ruleList.map((r) =>
            //     console.log(
            //         `dim: ${r.IO_DIM.join(",")}, input: ${r.input.join(
            //             ","
            //         )}, output: ${r.output.join(",")}`
            //     )
            // );
        }
        this.rules = ruleList.concat([]);
        this.last = new Uint8Array(rules.length);

        console.log(`RuleNode has ${this.rules.length} rules`);

        this.steps = parseInt(elem.getAttribute("steps")) || 0;
        this.temperature = parseFloat(elem.getAttribute("temperature")) || 0;

        const efields = Helper.collectionToArr(
            elem.getElementsByTagName("field")
        );

        if (efields.length) {
            this.fields = Array.from({ length: grid.C });
            for (const efield of efields)
                this.fields[
                    grid.values.get(parseInt(efield.getAttribute("for")))
                ] = new Field(efield, grid);

            this.potentials = new Array2D(
                Int32Array,
                grid.state.length,
                grid.C
            );
            this.potentials.fill(0);

            console.log(`RuleNode has ${this.fields.length} fields`);
        }

        const eobs = Helper.collectionToArr(
            elem.getElementsByTagName("observe")
        );
        if (eobs.length) {
            this.observations = Array.from({ length: grid.C });
            for (const eob of eobs) {
                const value = grid.values.get(
                    eob.getAttribute("value").charCodeAt(0)
                );
                this.observations[value] = new Observation(
                    eob.getAttribute("from")?.charCodeAt(0) ||
                        grid.characters.charCodeAt(value),
                    eob.getAttribute("to"),
                    grid
                );
            }

            this.search = elem.getAttribute("search") === "True";
            if (this.search) {
                this.limit = parseInt(elem.getAttribute("limit")) || -1;
                this.depthCoefficient =
                    parseFloat(elem.getAttribute("depthCoefficient")) || 0.5;
            } else if (!this.potentials) {
                this.potentials = new Array2D(
                    Int32Array,
                    grid.state.length,
                    grid.C
                );
            }
            this.future = new Int32Array(grid.state.length);

            console.log(
                `RuleNode has ${this.observations.length} observations`
            );
        }

        return true;
    }

    public override reset() {
        this.lastMatchedTurn = -1;
        this.counter = 0;
        this.futureComputed = false;
        this.last.fill(0);
    }

    protected add(
        r: number,
        x: number,
        y: number,
        z: number,
        maskr: BoolArray2DRow
    ) {
        maskr.set(x + y * this.grid.MX + z * this.grid.MX * this.grid.MY, true);

        // Reuse array
        const offset = this.matchCount << 2;
        if (offset + 4 < this.matches.length) {
            this.matches[offset + 0] = r;
            this.matches[offset + 1] = x;
            this.matches[offset + 2] = y;
            this.matches[offset + 3] = z;
        } else {
            // Realloc
            const old = this.matches;
            this.matches = new Uint32Array((old.length + 4) << 1);
            this.matches.set(old);
            this.matches[offset + 0] = r;
            this.matches[offset + 1] = x;
            this.matches[offset + 2] = y;
            this.matches[offset + 3] = z;
        }
        this.matchCount++;
    }

    public override run() {
        this.last.fill(0);

        if (this.steps > 0 && this.counter >= this.steps) return false;

        const grid = this.grid;
        const { MX, MY, MZ } = grid;

        if (this.observations && !this.futureComputed) {
            if (
                !Observation.computeFutureSetPresent(
                    this.future,
                    grid.state,
                    this.observations
                )
            ) {
                return false;
            } else {
                this.futureComputed = true;
                if (this.search) {
                    this.trajectory = null;
                    const TRIES = this.limit < 0 ? 1 : 20;
                    for (let k = 0; k < TRIES && !this.trajectory; k++) {
                        const result = Search.run(
                            grid.state,
                            this.future,
                            this.rules,
                            grid.MX,
                            grid.MY,
                            grid.MZ,
                            grid.C,
                            this instanceof AllNode,
                            this.limit,
                            this.depthCoefficient,
                            this.ip.rng.int32()
                        );
                        this.trajectory = Array2D.from(Uint8Array, result);
                    }
                    if (!this.trajectory) console.error("SEARCH RETURNED NULL");
                } else
                    Observation.computeBackwardPotentials(
                        this.potentials,
                        this.future,
                        MX,
                        MY,
                        MZ,
                        this.rules
                    );
            }
        }

        if (this.lastMatchedTurn >= 0) {
            const ip = this.ip;
            for (
                let n = ip.first[this.lastMatchedTurn];
                n < ip.changes.length;
                n++
            ) {
                const [x, y, z] = ip.changes[n];
                const value = grid.state[x + y * MX + z * MX * MY];
                for (let r = 0; r < this.rules.length; r++) {
                    const rule = this.rules[r];
                    const maskr = this.matchMask.row(r);
                    const shifts = rule.ishifts[value];
                    for (const [shiftx, shifty, shiftz] of shifts) {
                        const sx = x - shiftx;
                        const sy = y - shifty;
                        const sz = z - shiftz;

                        if (
                            sx < 0 ||
                            sy < 0 ||
                            sz < 0 ||
                            sx + rule.IMX > MX ||
                            sy + rule.IMY > MY ||
                            sz + rule.IMZ > MZ
                        )
                            continue;
                        const si = sx + sy * MX + sz * MX * MY;

                        if (!maskr.get(si) && grid.matches(rule, sx, sy, sz))
                            this.add(r, sx, sy, sz, maskr);
                    }
                }
            }
        } else {
            this.matchCount = 0;
            for (let r = 0; r < this.rules.length; r++) {
                const rule = this.rules[r];
                const maskr = this.matchMask?.row(r);
                for (let z = rule.IMZ - 1; z < MZ; z += rule.IMZ)
                    for (let y = rule.IMY - 1; y < MY; y += rule.IMY)
                        for (let x = rule.IMX - 1; x < MX; x += rule.IMX) {
                            const offset = x + y * MX + z * MX * MY;
                            const value = grid.state[offset];
                            const shifts = rule.ishifts[value];
                            for (const [shiftx, shifty, shiftz] of shifts) {
                                const sx = x - shiftx;
                                const sy = y - shifty;
                                const sz = z - shiftz;
                                if (
                                    sx < 0 ||
                                    sy < 0 ||
                                    sz < 0 ||
                                    sx + rule.IMX > MX ||
                                    sy + rule.IMY > MY ||
                                    sz + rule.IMZ > MZ
                                )
                                    continue;

                                if (grid.matches(rule, sx, sy, sz))
                                    this.add(r, sx, sy, sz, maskr);
                            }
                        }
            }
        }

        if (this.fields) {
            let anysuccess = false,
                anycomputation = false;
            for (let c = 0; c < this.fields.length; c++) {
                const field = this.fields[c];
                if (field && (this.counter === 0 || field.recompute)) {
                    // TODO: make sure this is right
                    const success = field.compute(this.potentials.row(c), grid);
                    if (!success && field.essential) return false;
                    anysuccess ||= success;
                    anycomputation = true;
                }
            }
            if (anycomputation && !anysuccess) return false;
        }

        return true;
    }
}
