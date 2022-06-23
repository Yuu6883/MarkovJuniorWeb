import { Grid } from "../grid";
import { SymmetryHelper } from "../helpers/symmetry";
import { Branch } from "./";
import { Rule } from "../rule";
import { Helper } from "../helpers/helper";

const readScale = (s: string): [number, number] => {
    if (!s.includes("/")) return [parseInt(s), 1];
    const nd = s.split("/");
    return [parseInt(nd[0]), parseInt(nd[1])];
};

export class MapNode extends Branch {
    private newgrid: Grid;
    private rules: Rule[] = [];
    private ND = new Int32Array(6);

    protected override async load(
        elem: Element,
        parentSymmetry: Uint8Array,
        grid: Grid
    ) {
        const scalestring = elem.getAttribute("scale");
        if (!scalestring) {
            console.error(elem, "scale should be specified in map node");
            return false;
        }
        const scales = scalestring.split(" ");
        if (scales.length !== 3) {
            console.error(
                elem,
                `scale attribute ${scalestring} should have 3 components separated by space`
            );
            return false;
        }

        const [NX, DX] = readScale(scales[0]);
        const [NY, DY] = readScale(scales[1]);
        const [NZ, DZ] = readScale(scales[2]);

        this.ND.set([NX, NY, NZ, DX, DY, DZ]);

        this.newgrid = Grid.build(
            elem,
            ~~((NX * grid.MX) / DX),
            ~~((NY * grid.MY) / DY),
            ~~((NZ * grid.MZ) / DZ)
        );
        if (!this.newgrid) return false;

        if (!(await super.load(elem, parentSymmetry, this.newgrid)))
            return false;
        const symmetry = SymmetryHelper.getSymmetry(
            grid.MZ === 1,
            elem.getAttribute("symmetry"),
            parentSymmetry
        );

        const rules = Helper.collectionToArr(elem.getElementsByTagName("rule"));
        for (const e of rules) {
            const rule = await Rule.load(e, grid, this.newgrid);
            if (!rule) return false;
            rule.symmetries(symmetry, grid.MZ === 1).forEach((r) =>
                this.rules.push(r)
            );
        }

        return true;
    }

    static matches(
        rule: Rule,
        x: number,
        y: number,
        z: number,
        state: Uint8Array,
        MX: number,
        MY: number,
        MZ: number
    ) {
        for (let dz = 0; dz < rule.IMZ; dz++)
            for (let dy = 0; dy < rule.IMY; dy++)
                for (let dx = 0; dx < rule.IMX; dx++) {
                    let sx = x + dx;
                    let sy = y + dy;
                    let sz = z + dz;

                    if (sx >= MX) sx -= MX;
                    if (sy >= MY) sy -= MY;
                    if (sz >= MZ) sz -= MZ;

                    const inputWave =
                        rule.input[
                            dx + dy * rule.IMX + dz * rule.IMX * rule.IMY
                        ];
                    if (
                        (inputWave &
                            (1 << state[sx + sy * MX + sz * MX * MY])) ===
                        0
                    )
                        return false;
                }

        return true;
    }

    static apply(
        rule: Rule,
        x: number,
        y: number,
        z: number,
        state: Uint8Array,
        MX: number,
        MY: number,
        MZ: number
    ) {
        for (let dz = 0; dz < rule.OMZ; dz++)
            for (let dy = 0; dy < rule.OMY; dy++)
                for (let dx = 0; dx < rule.OMX; dx++) {
                    let sx = x + dx;
                    let sy = y + dy;
                    let sz = z + dz;

                    if (sx >= MX) sx -= MX;
                    if (sy >= MY) sy -= MY;
                    if (sz >= MZ) sz -= MZ;

                    const output =
                        rule.output[
                            dx + dy * rule.OMX + dz * rule.OMX * rule.OMY
                        ];
                    if (output != 0xff)
                        state[sx + sy * MX + sz * MX * MY] = output;
                }
    }

    public override run() {
        if (this.n >= 0) return super.run();

        const grid = this.grid;
        const newgrid = this.newgrid;
        const [NX, NY, NZ, DX, DY, DZ] = this.ND;

        this.newgrid.clear();
        for (const rule of this.rules) {
            for (let z = 0; z < grid.MZ; z++)
                for (let y = 0; y < grid.MY; y++)
                    for (let x = 0; x < grid.MX; x++)
                        if (
                            MapNode.matches(
                                rule,
                                x,
                                y,
                                z,
                                grid.state,
                                grid.MX,
                                grid.MY,
                                grid.MZ
                            )
                        )
                            MapNode.apply(
                                rule,
                                ~~((x * NX) / DX),
                                ~~((y * NY) / DY),
                                ~~((z * NZ) / DZ),
                                newgrid.state,
                                newgrid.MX,
                                newgrid.MY,
                                newgrid.MZ
                            );
        }

        this.ip.grid = newgrid;
        this.n++;

        return true;
    }

    public override reset() {
        super.reset();
        this.n = -1;
    }
}
