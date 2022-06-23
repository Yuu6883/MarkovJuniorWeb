import { Grid } from "./grid";
import { Array3Dflat } from "./helpers/datastructures";
import { Helper, vec3 } from "./helpers/helper";
import { SymmetryHelper } from "./helpers/symmetry";

declare type Shift = vec3[][];

export class Rule {
    public readonly IO_DIM: Int32Array;

    public input: Int32Array;
    public output: Uint8Array;
    public binput: Uint8Array;

    public p: number;
    public ishifts: Shift;
    public oshifts: Shift;

    public original: boolean;

    constructor(
        input: Int32Array,
        output: Uint8Array,
        IO_DIM: ArrayLike<number>,
        C: number,
        p: number
    ) {
        this.input = input;
        this.output = output;
        this.IO_DIM = new Int32Array(IO_DIM); // copy
        this.p = p;

        const lists = Array.from({ length: C }, (_) => [] as vec3[]);

        const [IMX, IMY, IMZ, OMX, OMY, OMZ] = this.IO_DIM;

        for (let z = 0; z < IMZ; z++)
            for (let y = 0; y < IMY; y++)
                for (let x = 0; x < IMX; x++) {
                    let w = input[x + y * IMX + z * IMX * IMY];
                    for (let c = 0; c < C; c++, w >>= 1)
                        if ((w & 1) === 1) lists[c].push([x, y, z]);
                }

        this.ishifts = Array.from({ length: C });
        // TODO: do we need to deep copy the inner array as well?
        for (let c = 0; c < C; c++) this.ishifts[c] = lists[c].concat([]);

        if (OMX === IMX && OMY === IMY && OMZ === IMZ) {
            for (let c = 0; c < C; c++) lists[c] = [];
            for (let z = 0; z < OMZ; z++)
                for (let y = 0; y < OMY; y++)
                    for (let x = 0; x < OMX; x++) {
                        const o = output[x + y * OMX + z * OMX * OMY];
                        if (o !== 0xff) lists[o].push([x, y, z]);
                        else
                            for (let c = 0; c < C; c++)
                                lists[c].push([x, y, z]);
                    }
            this.oshifts = Array.from({ length: C });
            for (let c = 0; c < C; c++) this.oshifts[c] = lists[c].concat([]);
        }

        const wildcard = (1 << C) - 1;
        this.binput = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const w = input[i];
            this.binput[i] =
                w === wildcard ? 0xff : Helper.firstNonZeroPosition(w);
        }
    }

    public ZRotated() {
        const [IMX, IMY, IMZ, OMX, OMY, OMZ] = this.IO_DIM;

        const newinput = new Int32Array(this.input.length);
        for (let z = 0; z < IMZ; z++)
            for (let y = 0; y < IMX; y++)
                for (let x = 0; x < IMY; x++)
                    newinput[x + y * IMY + z * IMX * IMY] =
                        this.input[IMX - 1 - y + x * IMX + z * IMX * IMY];

        const newoutput = new Uint8Array(this.output.length);
        for (let z = 0; z < OMZ; z++)
            for (let y = 0; y < OMX; y++)
                for (let x = 0; x < OMY; x++)
                    newoutput[x + y * OMY + z * OMX * OMY] =
                        this.output[OMX - 1 - y + x * OMX + z * OMX * OMY];

        return new Rule(
            newinput,
            newoutput,
            [IMY, IMX, IMZ, OMY, OMX, OMZ],
            this.ishifts.length,
            this.p
        );
    }

    public YRotated() {
        const [IMX, IMY, IMZ, OMX, OMY, OMZ] = this.IO_DIM;

        const newinput = new Int32Array(this.input.length);

        for (let z = 0; z < IMX; z++)
            for (let y = 0; y < IMY; y++)
                for (let x = 0; x < IMZ; x++)
                    newinput[x + y * IMZ + z * IMZ * IMY] =
                        this.input[IMX - 1 - z + y * IMX + x * IMX * IMY];

        const newoutput = new Uint8Array(this.output.length);
        for (let z = 0; z < OMX; z++)
            for (let y = 0; y < OMY; y++)
                for (let x = 0; x < OMZ; x++)
                    newoutput[x + y * OMZ + z * OMZ * OMY] =
                        this.output[OMX - 1 - z + y * OMX + x * OMX * OMY];

        return new Rule(
            newinput,
            newoutput,
            [IMZ, IMY, IMX, OMZ, OMY, OMX],
            this.ishifts.length,
            this.p
        );
    }

    public reflected() {
        const [IMX, IMY, IMZ, OMX, OMY, OMZ] = this.IO_DIM;

        const newinput = new Int32Array(this.input.length);
        for (let z = 0; z < IMZ; z++)
            for (let y = 0; y < IMY; y++)
                for (let x = 0; x < IMX; x++)
                    newinput[x + y * IMX + z * IMX * IMY] =
                        this.input[IMX - 1 - x + y * IMX + z * IMX * IMY];

        const newoutput = new Uint8Array(this.output.length);
        for (let z = 0; z < OMZ; z++)
            for (let y = 0; y < OMY; y++)
                for (let x = 0; x < OMX; x++)
                    newoutput[x + y * OMX + z * OMX * OMY] =
                        this.output[OMX - 1 - x + y * OMX + z * OMX * OMY];

        return new Rule(
            newinput,
            newoutput,
            [IMX, IMY, IMZ, OMX, OMY, OMZ],
            this.ishifts.length,
            this.p
        );
    }

    public static same(a1: Rule, a2: Rule) {
        return (
            Helper.compareArr(a1.IO_DIM, a2.IO_DIM) &&
            Helper.compareArr(a1.input, a2.input) &&
            Helper.compareArr(a1.output, a2.output)
        );
    }

    public symmetries(symmetry: Uint8Array, d2: boolean) {
        return d2
            ? SymmetryHelper.squareSymmetries(
                  this,
                  (r) => r.ZRotated(),
                  (r) => r.reflected(),
                  Rule.same,
                  symmetry
              )
            : SymmetryHelper.cubeSymmetries(
                  this,
                  (r) => r.ZRotated(),
                  (r) => r.YRotated(),
                  (r) => r.reflected(),
                  Rule.same,
                  symmetry
              );
    }

    public static async loadResource(
        path: string,
        legend: string,
        d2: boolean
    ): Promise<[Int8Array, number, number, number]> {
        // TODO

        return [null, -1, -1, -1];
    }

    public static parse(s: string): [Int8Array, number, number, number] {
        const lines = Helper.split2(s, " ", "/");
        const MX = lines[0][0].length;
        const MY = lines[0].length;
        const MZ = lines.length;
        const result = new Int8Array(MX * MY * MZ);

        for (let z = 0; z < MZ; z++) {
            const linesz = lines[MZ - 1 - z];
            if (linesz.length !== MY) {
                console.error("non-rectangular pattern");
                return [null, -1, -1, -1];
            }
            for (let y = 0; y < MY; y++) {
                const lineszy = linesz[y];
                if (lineszy.length !== MX) {
                    console.error("non-rectangular pattern");
                    return [null, -1, -1, -1];
                }
                for (let x = 0; x < MX; x++) {
                    const code = lineszy.charCodeAt(x);
                    if (code <= 0 || code > 128) {
                        console.error(`invalid character code: ${code}`);
                    }
                    result[x + y * MX + z * MX * MY] = code;
                }
            }
        }

        return [result, MX, MY, MZ];
    }

    public static async load(elem: Element, gin: Grid, gout: Grid) {
        const filepath = (name: string) => {
            return "TODO";
        };

        const inString = elem.getAttribute("in");
        const outString = elem.getAttribute("out");
        const finString = elem.getAttribute("fin");
        const foutString = elem.getAttribute("fout");
        const fileString = elem.getAttribute("file");
        const legend = elem.getAttribute("legend");

        let inRect: Int8Array, outRect: Int8Array;

        let IMX = -1,
            IMY = -1,
            IMZ = -1,
            OMX = -1,
            OMY = -1,
            OMZ = -1;

        if (!fileString) {
            if (!inString && !finString) {
                console.error(elem, "no intput");
                return null;
            }
            if (!outString && !foutString) {
                console.error(elem, "no output");
                return null;
            }

            [inRect, IMX, IMY, IMZ] = inString
                ? this.parse(inString)
                : await this.loadResource(
                      filepath(finString),
                      legend,
                      gin.MZ === 1
                  );
            if (!inRect) {
                console.error(elem, "failed to load input");
                return null;
            }

            // TODO: gout or gin (source has gin)
            [outRect, OMX, OMY, OMZ] = outString
                ? this.parse(outString)
                : await this.loadResource(
                      filepath(finString),
                      legend,
                      gout.MZ === 1
                  );
            if (!outRect) {
                console.error(elem, "failed to load input");
                return null;
            }

            if (gin === gout && (OMZ != IMZ || OMY != IMY || OMX != IMX)) {
                console.error(elem, "non-matching pattern sizes");
                return null;
            }
        } else {
            if (inString || finString || outString || foutString) {
                console.error(elem, "already contains a file attribute");
                return null;
            }

            const [rect, FX, FY, FZ] = await this.loadResource(
                filepath(fileString),
                legend,
                gin.MZ === 1
            );
            if (!rect) {
                console.error(elem, "failed to load input");
                return null;
            }
            if (FX % 2) {
                console.error(elem, `odd width in ${fileString}`);
                return null;
            }

            IMX = OMX = FX / 2;
            IMY = OMY = FY;
            IMZ = OMZ = FZ;

            inRect = Array3Dflat(
                Int8Array,
                FX / 2,
                FY,
                FZ,
                (x, y, z) => rect[x + y * FX + z * FX * FY]
            );

            outRect = Array3Dflat(
                Int8Array,
                FX / 2,
                FY,
                FZ,
                (x, y, z) => rect[x + FX / 2 + y * FX + z * FX * FY]
            );
        }

        const input = new Int32Array(inRect.length);
        for (let i = 0; i < inRect.length; i++) {
            const c = inRect[i];
            const value = gin.waves.get(c);
            if (value === null) {
                console.error(elem, `input code ${c} is not found in codes`);
                return null;
            }
            input[i] = value;
        }

        const output = new Uint8Array(outRect.length);
        for (let o = 0; o < outRect.length; o++) {
            const c = outRect[o];
            if (c === "*".charCodeAt(0)) output[o] = 0xff;
            else {
                const value = gout.values.get(c);
                if (value === null) {
                    console.error(
                        elem,
                        `output code ${c} is not found in codes`
                    );
                    return null;
                }
                output[o] = value;
            }
        }

        const p = parseFloat(elem.getAttribute("p")) || 1.0;
        return new Rule(
            input,
            output,
            [IMX, IMY, IMZ, OMX, OMY, OMZ],
            gin.C,
            p
        );
    }

    get IMX() {
        return this.IO_DIM[0];
    }

    get IMY() {
        return this.IO_DIM[1];
    }

    get IMZ() {
        return this.IO_DIM[2];
    }

    get OMX() {
        return this.IO_DIM[3];
    }

    get OMY() {
        return this.IO_DIM[4];
    }

    get OMZ() {
        return this.IO_DIM[5];
    }
}
