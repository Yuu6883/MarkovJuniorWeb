import seedrandom from "seedrandom";
import { Grid } from "../grid";
import { Array2D } from "../helpers/datastructures";
import { Graphics } from "../helpers/graphics";
import { Helper } from "../helpers/helper";
import { SymmetryHelper } from "../helpers/symmetry";
import { WFCNode } from "./wfc";

export class OverlapNode extends WFCNode {
    private patterns: Uint8Array[];

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

        const periodicInput = elem.getAttribute("periodicInput") === "True";

        this.newgrid = Grid.load(elem, grid.MX, grid.MY, grid.MZ);
        if (!this.newgrid) return false;
        this.periodic = true;

        this.name = elem.getAttribute("sample");
        const [bitmap, SMX, SMY] = Graphics.loadBitmap(
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
        const patternFromIndex = (ind: bigint) => {
            let residue = ind,
                power = BigInt(W);
            const result = new Uint8Array(N * N);
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

        let ymax = periodicInput ? grid.MY : grid.MY - N + 1;
        let xmax = periodicInput ? grid.MX : grid.MX - N + 1;
        for (let y = 0; y < ymax; y++)
            for (let x = 0; x < xmax; x++) {
                const ps: Uint8Array[] = Array.from({ length: 8 });

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
                        if (w !== null) weights.set(ind, w + 1);
                        else {
                            weights.set(ind, 1);
                            ordering.push(ind);
                        }
                    }
            }

        const P = (this.P = weights.size);
        console.log(`number of patterns P = ${P}`);

        this.patterns = new Array(P);
        super.weights = new Float64Array(P);
        let counter = 0;

        for (const w of ordering) {
            this.patterns[counter] = patternFromIndex(w);
            super.weights[counter] = weights[Number(w)];
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
                            this.patterns[t],
                            this.patterns[t2],
                            OverlapNode.DX[d],
                            OverlapNode.DY[d]
                        )
                    )
                        list.push(t2);
                this.propagator[d][t] = new Int32Array(list);
            }
        }

        this.map = new Map();
        for (const rule of Helper.collectionToArr(
            elem.getElementsByTagName("rule")
        )) {
            const input = rule.getAttribute("in").charCodeAt(0);
            const outputs = rule
                .getAttribute("out")
                .split("|")
                .map((s) => this.newgrid.values.get(s.charCodeAt(0)));
            const position = new Uint8Array(
                Array.from({ length: P }, (_, k) =>
                    outputs.includes(this.patterns[k][0]) ? 1 : 0
                )
            );
            this.map.set(grid.values.get(input), position);
        }

        if (!this.map.has(0)) {
            this.map.set(0, new Uint8Array(new Array(P).fill(1)));
        }

        return super.load(elem, parentSymmetry, grid);
    }

    protected override updateState() {
        const { newgrid, wave, patterns, P, N } = this;
        const { MX, MY } = newgrid;
        const votes = new Array2D(
            Int32Array,
            newgrid.state.length,
            newgrid.C,
            0
        );

        for (let i = 0; i < wave.data.ROWS; i++) {
            const w = wave.data[i];
            let x = i % MX,
                y = i / MX;
            for (let p = 0; p < P; p++)
                if (w[p]) {
                    const pattern = patterns[p];
                    for (let dy = 0; dy < N; dy++) {
                        let ydy = y + dy;
                        if (ydy >= MY) ydy -= MY;
                        for (let dx = 0; dx < N; dx++) {
                            let xdx = x + dx;
                            if (xdx >= MX) xdx -= MX;
                            const value = pattern[dx + dy * N];
                            votes.row(value)[xdx + ydy * MX]++;
                        }
                    }
                }
        }

        const rng = seedrandom();
        for (let i = 0; i < votes.ROWS; i++) {
            let max = -1.0;
            let argmax = 0xff;
            const v = votes.row(i);
            for (let c = 0; c < v.length; c++) {
                let value = v[c] + 0.1 * rng.double();
                if (value > max) {
                    argmax = c;
                    max = value;
                }
            }
            newgrid.state[i] = argmax;
        }
    }
}
