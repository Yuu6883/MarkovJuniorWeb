import { Grid } from "../grid";
import { Array3D, BoolArray2D } from "../helpers/datastructures";
import { Branch, Node } from "./node";
import seedrandom, { PRNG } from "seedrandom";
import { Helper } from "../helpers/helper";

export abstract class WFCNode extends Branch {
    protected wave: Wave;
    protected propagator: number[][][];
    protected P = 1;
    protected N = 1;

    private stack: Int32Array;
    private stacksize = 0;

    protected weights: Float64Array;
    private weightLogWeights: Float64Array;

    private sumOfWeights = 0;
    private sumOfWeightLogWeights = 0;
    private startingEntropy = 0;

    protected newgrid: Grid;
    private startwave: Wave;

    protected map: Map<number, Uint8Array> = new Map();
    protected periodic: boolean;
    protected shannon: boolean;

    private distribution: Float64Array;
    private tries: number;

    public name: string;

    private firstgo = true;
    private rng: PRNG;

    protected override load(
        elem: Element,
        parentSymmetry: Uint8Array,
        grid: Grid
    ): boolean {
        this.shannon = elem.getAttribute("shannon") === "True";
        this.tries = parseInt(elem.getAttribute("tries")) || 1000;

        this.wave = new Wave(
            grid.state.length,
            this.P,
            this.propagator.length,
            this.shannon
        );

        this.startwave = new Wave(
            grid.state.length,
            this.P,
            this.propagator.length,
            this.shannon
        );
        this.stack = new Int32Array(this.wave.data.MY * this.P * 2);

        if (this.shannon) {
            this.weightLogWeights = new Float64Array(this.P);

            for (let t = 0; t < this.P; t++) {
                this.weightLogWeights[t] =
                    this.weights[t] * Math.log(this.weights[t]);
                this.sumOfWeights += this.weights[t];
                this.sumOfWeightLogWeights += this.weightLogWeights[t];
            }

            this.startingEntropy =
                Math.log(this.sumOfWeights) -
                this.sumOfWeightLogWeights / this.sumOfWeights;
        }

        this.distribution = new Float64Array(this.P);
        return super.load(elem, parentSymmetry, this.newgrid);
    }

    public override reset(): void {
        super.reset();
        this.n = -1;
        this.firstgo = true;
    }

    public override run(): boolean {
        if (this.n >= 0) return super.run();

        if (this.firstgo) {
            this.wave.init(
                this.propagator,
                this.sumOfWeights,
                this.sumOfWeightLogWeights,
                this.startingEntropy,
                this.shannon
            );

            for (let i = 0; i < this.wave.data.MY; i++) {
                const value = this.grid.state[i];
                const startWave = this.map.get(value);
                if (startWave) {
                    for (let t = 0; t < this.P; t++)
                        if (!startWave[t]) this.ban(i, t);
                }
            }

            const firstSuccess = this.propagate();
            if (!firstSuccess) {
                console.error("WFC initial conditions are contradictive");
                return false;
            }
            this.startwave.copyFrom(
                this.wave,
                this.propagator.length,
                this.shannon
            );
            const goodseed = this.goodSeed();
            if (goodseed === null) return false;

            this.rng = seedrandom(goodseed.toString());
            this.stacksize = 0;
            this.wave.copyFrom(
                this.startwave,
                this.propagator.length,
                this.shannon
            );
            this.firstgo = false;

            this.newgrid.clear();
            this.ip.grid = this.newgrid;
            return true;
        } else {
            const node = this.nextUnobservedNode(this.rng);
            if (node >= 0) {
                this.observe(node, this.rng);
                this.propagate();
            } else this.n++;

            if (this.n >= 0 || this.ip.gif) this.updateState();
            return true;
        }
    }

    goodSeed(): number {
        for (let k = 0; k < this.tries; k++) {
            let obs = 0;
            const seed = this.ip.rng.int32();
            this.rng = seedrandom(seed.toString());
            this.stacksize = 0;
            this.wave.copyFrom(
                this.startwave,
                this.propagator.length,
                this.shannon
            );

            while (true) {
                const node = this.nextUnobservedNode(this.rng);

                if (node >= 0) {
                    this.observe(node, this.rng);
                    obs++;
                    const success = this.propagate();
                    if (!success) {
                        console.error(
                            `CONTRADICTION on try#${k} with ${obs} observations`
                        );
                        break;
                    }
                } else {
                    console.log(
                        `WFC found a good seed ${seed} on try#${k} with ${obs} observations`
                    );
                    return seed;
                }
            }
        }

        console.error(`WFC failed to find a good seed in ${this.tries} tries`);
        return null;
    }

    nextUnobservedNode(rng: PRNG) {
        const { MX, MY, MZ } = this.grid;
        const N = this.N;
        let min = 1e4;
        let argmin = -1;
        for (let z = 0; z < MZ; z++)
            for (let y = 0; y < MY; y++)
                for (let x = 0; x < MX; x++) {
                    if (
                        !this.periodic &&
                        (x + N > MX || y + N > MY || z + 1 > MZ)
                    )
                        continue;
                    const i = x + y * MX + z * MX * MY;
                    const remainingValues = this.wave.sumsOfOnes[i];
                    const entropy = this.shannon
                        ? this.wave.entropies[i]
                        : remainingValues;
                    if (remainingValues > 1 && entropy <= min) {
                        const noise = 1e-6 * rng.double();
                        if (entropy + noise < min) {
                            min = entropy + noise;
                            argmin = i;
                        }
                    }
                }
        return argmin;
    }

    observe(node: number, rng: PRNG) {
        const w = this.wave.data;
        for (let t = 0; t < this.P; t++)
            this.distribution[t] = w.get(t, node) ? this.weights[t] : 0;
        let r = Helper.sampleWeights(this.distribution, rng.double());
        for (let t = 0; t < this.P; t++)
            if (w.get(t, node) !== (t === r)) this.ban(node, t);
    }

    propagate(): boolean {
        const N = this.N;
        const { MX, MY, MZ } = this.grid;

        while (this.stacksize > 0) {
            const i1 = this.stack[this.stacksize - 2];
            const p1 = this.stack[this.stacksize - 1];
            this.stacksize -= 2;

            // TODO: make sure this part is actually correct
            const x1 = i1 % MX,
                y1 = ~~((i1 % (MX * MY)) / MX),
                z1 = ~~(i1 / (MX * MY));

            for (let d = 0; d < this.propagator.length; d++) {
                const dx = WFCNode.DX[d],
                    dy = WFCNode.DY[d],
                    dz = WFCNode.DZ[d];
                let x2 = x1 + dx,
                    y2 = y1 + dy,
                    z2 = z1 + dz;
                if (
                    !this.periodic &&
                    (x2 < 0 ||
                        y2 < 0 ||
                        z2 < 0 ||
                        x2 + N > MX ||
                        y2 + N > MY ||
                        z2 + 1 > MZ)
                )
                    continue;

                if (x2 < 0) x2 += MX;
                else if (x2 >= MX) x2 -= MX;
                if (y2 < 0) y2 += MY;
                else if (y2 >= MY) y2 -= MY;
                if (z2 < 0) z2 += MZ;
                else if (z2 >= MZ) z2 -= MZ;

                const i2 = x2 + y2 * MX + z2 * MX * MY;
                const p = this.propagator[d][p1];

                for (let l = 0; l < p.length; l++) {
                    const t2 = p[l];

                    const v = this.wave.compatible.get(d, t2, i2) - 1;
                    this.wave.compatible.set(d, t2, i2, v);
                    if (v === 0) this.ban(i2, t2);
                }
            }
        }

        return this.wave.sumsOfOnes[0] > 0;
    }

    ban(i: number, t: number) {
        const wave = this.wave;
        wave.data.set(t, i, false);

        for (let d = 0; d < this.propagator.length; d++)
            wave.compatible.set(d, t, i, 0);

        this.stack[this.stacksize + 0] = i;
        this.stack[this.stacksize + 1] = t;
        this.stacksize += 2;

        wave.sumsOfOnes[i] -= 1;
        if (this.shannon) {
            let sum = wave.sumsOfWeights[i];

            wave.entropies[i] +=
                wave.sumsOfWeightLogWeights[i] / sum - Math.log(sum);

            wave.sumsOfWeights[i] -= this.weights[t];
            wave.sumsOfWeightLogWeights[i] -= this.weightLogWeights[t];

            sum = wave.sumsOfWeights[i];
            wave.entropies[i] -=
                wave.sumsOfWeightLogWeights[i] / sum - Math.log(sum);
        }
    }

    protected abstract updateState();

    protected static DX = new Int8Array([1, 0, -1, 0, 0, 0]);
    protected static DY = new Int8Array([0, 1, 0, -1, 0, 0]);
    protected static DZ = new Int8Array([0, 0, 0, 0, 1, -1]);
}

class Wave {
    readonly data: BoolArray2D;
    readonly compatible: Array3D<Int32Array>;

    readonly sumsOfOnes: Int32Array;
    readonly sumsOfWeights: Float64Array;
    readonly sumsOfWeightLogWeights: Float64Array;
    readonly entropies: Float64Array;

    constructor(length: number, P: number, D: number, shannon: boolean) {
        this.data = new BoolArray2D(length, P);
        this.data.fill();

        this.compatible = new Array3D((l) => new Int32Array(l), length, P, D);
        this.compatible.arr.fill(-1);

        this.sumsOfOnes = new Int32Array(length);

        if (shannon) {
            this.sumsOfWeights = new Float64Array(length);
            this.sumsOfWeightLogWeights = new Float64Array(length);
            this.entropies = new Float64Array(length);
        }
    }

    public init(
        propagator: number[][][],
        sumOfWeights: number,
        sumOfWeightLogWeights: number,
        startingEntropy: number,
        shannon: boolean
    ) {
        this.data.fill();

        const P = this.data.MX;
        for (let i = 0; i < this.data.MY; i++) {
            for (let p = 0; p < P; p++) {
                for (let d = 0; d < propagator.length; d++) {
                    // TODO: is this correct
                    this.compatible.set(
                        d,
                        p,
                        i,
                        propagator[Wave.opposite[d]][p].length
                    );
                }
            }

            if (shannon) {
                this.sumsOfWeights[i] = sumOfWeights;
                this.sumsOfWeightLogWeights[i] = sumOfWeightLogWeights;
                this.entropies[i] = startingEntropy;
            }
        }
    }

    public copyFrom(wave: Wave, D: number, shannon: boolean) {
        for (let i = 0; i < this.data.MY; i++) {
            for (let t = 0; t < this.data.MX; t++) {
                this.data.set(t, i, wave.data.get(t, i));
                for (let d = 0; d < D; d++) {
                    this.compatible.set(d, t, i, wave.compatible.get(d, t, i));
                }
            }

            this.sumsOfOnes[i] = wave.sumsOfOnes[i];

            if (shannon) {
                this.sumsOfWeights[i] = wave.sumsOfWeights[i];
                this.sumsOfWeightLogWeights[i] = wave.sumsOfWeightLogWeights[i];
                this.entropies[i] = wave.entropies[i];
            }
        }
    }

    static readonly opposite = new Uint8Array([2, 3, 0, 1, 5, 4]);
}
