import { Grid } from "../grid";
import { Array2D } from "../helpers/datastructures";
import { Helper } from "../helpers/helper";
import { Loader } from "../helpers/loader";
import { SymmetryHelper } from "../helpers/symmetry";

import { WFCNode } from "./";

export class OverlapNode extends WFCNode {
    private patterns: Array2D<Uint8Array>;
    private votes: Array2D<Uint32Array>;

    protected override async load(
        elem: Element,
        parentSymmetry: Uint8Array,
        grid: Grid
    ) {
        if (grid.MZ !== 1) {
            console.error("overlapping model currently works only for 2d");
            return false;
        }

        const N = (this.N = parseInt(elem.getAttribute("n")) || 3);

        const symmetryString = elem.getAttribute("symmetry");
        const symmetry = SymmetryHelper.getSymmetry(
            true,
            symmetryString,
            parentSymmetry
        );
        if (!symmetry) {
            console.error(elem, `unknown symmetry ${symmetryString}`);
            return false;
        }

        // Default to true
        const periodicInput = !(elem.getAttribute("periodicInput") === "False");

        this.newgrid = Grid.build(elem, grid.MX, grid.MY, grid.MZ);
        if (!this.newgrid) return false;
        this.periodic = true;

        this.name = elem.getAttribute("sample");
        const [bitmap, SMX, SMY] = await Loader.bitmap(
            `resources/samples/${this.name}.png`
        );
        if (!bitmap) {
            console.error(`Failed to read sample ${this.name}`);
            return false;
        }
        const [sample, C] = Helper.ords(bitmap);
        if (C > this.newgrid.C) {
            console.error(
                `There're more than ${this.newgrid.C} colors in the sample`
            );
            return false;
        }
        const W = Helper.intPower(C, N * N);

        const pattern = (f: (a: number, b: number) => number) => {
            const result = new Uint8Array(N * N);
            for (let y = 0; y < N; y++)
                for (let x = 0; x < N; x++) result[x + y * N] = f(x, y);
            return result;
        };

        const patternFromSample = (x: number, y: number) =>
            pattern(
                (dx, dy) => sample[((x + dx) % SMX) + ((y + dy) % SMY) * SMX]
            );
        const rotate = (p: Uint8Array) =>
            pattern((x, y) => p[N - 1 - y + x * N]);
        const reflect = (p: Uint8Array) =>
            pattern((x, y) => p[N - 1 - x + y * N]);

        const CLong = BigInt(C);
        const patternFromIndex = (
            ind: bigint,
            result = new Uint8Array(N * N)
        ) => {
            let residue = ind,
                power = BigInt(W);
            for (let i = 0; i < result.length; i++) {
                power /= CLong;
                let count = 0;
                while (residue >= power) {
                    residue -= power;
                    count++;
                }
                result[i] = count;
            }
            return result;
        };

        const weights: Map<bigint, number> = new Map();
        const ordering: bigint[] = [];

        const ymax = periodicInput ? grid.MY : grid.MY - N + 1;
        const xmax = periodicInput ? grid.MX : grid.MX - N + 1;

        const ps: Uint8Array[] = Array.from({ length: 8 });

        for (let y = 0; y < ymax; y++)
            for (let x = 0; x < xmax; x++) {
                ps[0] = patternFromSample(x, y);
                ps[1] = reflect(ps[0]);
                ps[2] = rotate(ps[0]);
                ps[3] = reflect(ps[2]);
                ps[4] = rotate(ps[2]);
                ps[5] = reflect(ps[4]);
                ps[6] = rotate(ps[4]);
                ps[7] = reflect(ps[6]);

                for (let k = 0; k < 8; k++)
                    if (symmetry[k]) {
                        const ind = Helper.indexByteArr(ps[k], CLong);

                        const w = weights.get(ind);
                        if (w !== undefined) {
                            weights.set(ind, w + 1);
                        } else {
                            weights.set(ind, 1);
                            ordering.push(ind);
                        }
                    }
            }

        const P = (this.P = weights.size);
        console.log(`number of patterns P = ${P}`);

        this.patterns = new Array2D(Uint8Array, N * N, P);
        this.weights = new Float64Array(P);
        let counter = 0;

        for (const w of ordering) {
            patternFromIndex(w, this.patterns.row(counter));
            this.weights[counter] = weights.get(w);
            counter++;
        }

        const agrees = (
            p1: Uint8Array,
            p2: Uint8Array,
            dx: number,
            dy: number
        ) => {
            let xmin = dx < 0 ? 0 : dx,
                xmax = dx < 0 ? dx + N : N,
                ymin = dy < 0 ? 0 : dy,
                ymax = dy < 0 ? dy + N : N;
            for (let y = ymin; y < ymax; y++)
                for (let x = xmin; x < xmax; x++)
                    if (p1[x + N * y] != p2[x - dx + N * (y - dy)])
                        return false;
            return true;
        };

        this.propagator = new Array(4);
        for (let d = 0; d < 4; d++) {
            this.propagator[d] = new Array(P);
            for (let t = 0; t < P; t++) {
                const list: number[] = [];
                for (let t2 = 0; t2 < P; t2++)
                    if (
                        agrees(
                            this.patterns.row(t),
                            this.patterns.row(t2),
                            OverlapNode.DX[d],
                            OverlapNode.DY[d]
                        )
                    )
                        list.push(t2);
                this.propagator[d][t] = new Int32Array(list);
            }
        }

        this.map = new Map();
        for (const rule of Helper.childrenByTag(elem, "rule")) {
            const input = rule.getAttribute("in").charCodeAt(0);
            const outputs = rule
                .getAttribute("out")
                .split("|")
                .map((s) => this.newgrid.values.get(s.charCodeAt(0)));
            const position = new Uint8Array(
                Array.from({ length: P }, (_, k) =>
                    outputs.includes(this.patterns.get(0, k)) ? 1 : 0
                )
            );
            this.map.set(grid.values.get(input), position);
        }

        if (!this.map.has(0)) {
            this.map.set(0, new Uint8Array(new Array(P).fill(1)));
        }

        this.votes = new Array2D(
            Uint32Array,
            this.newgrid.C,
            this.newgrid.state.length,
            0
        );

        return await super.load(elem, parentSymmetry, grid);
    }

    // No idea why this is x20 slower than C# (2000ms vs 100ms, WaveFlower)
    protected override updateState() {
        const { newgrid, wave, patterns, P, N, votes, rng } = this;
        const { MX, MY } = newgrid;

        const buf = votes.arr;
        const rows = votes.ROWS;
        const cols = votes.COLS;

        buf.fill(0);

        const drows = wave.data.ROWS;
        for (let p = 0; p < P; p++) {
            const pattern = patterns.row(p);
            for (let i = 0; i < drows; i++) {
                const x = i % MX,
                    y = ~~(i / MX);
                if (wave.data.get(p, i)) {
                    for (let dy = 0; dy < N; dy++) {
                        let ydy = y + dy;
                        if (ydy >= MY) ydy -= MY;
                        for (let dx = 0; dx < N; dx++) {
                            let xdx = x + dx;
                            if (xdx >= MX) xdx -= MX;
                            const value = pattern[dx + dy * N];
                            buf[value + (xdx + ydy * MX) * cols]++;
                        }
                    }
                }
            }
        }

        for (let i = 0; i < rows; i++) {
            let max = -1.0;
            let argmax = 0xff;

            const offset = i * cols;

            for (let c = 0; c < cols; c++) {
                const value = buf[offset + c] + 0.1 * rng.double();
                if (value > max) {
                    argmax = c;
                    max = value;
                }
            }
            newgrid.state[i] = argmax;
        }
    }
}
