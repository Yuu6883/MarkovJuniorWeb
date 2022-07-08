import { Grid } from "../grid";
import { SymmetryHelper } from "../helpers/symmetry";
import { Branch, RunState } from "./";
import { Rule } from "../rule";
import { Helper } from "../helpers/helper";

const readScale = (s: string): [number, number] => {
    if (!s.includes("/")) return [parseInt(s), 1];
    const nd = s.split("/");
    return [parseInt(nd[0]), parseInt(nd[1])];
};

export class MapNode extends Branch {
    public rules: Rule[] = [];

    private newgrid: Grid;
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

        for (const e of Helper.childrenByTag(elem, "rule")) {
            const rule = await Rule.load(e, grid, this.newgrid);
            rule.original = true;
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
        const { IMX, IMY, IMZ, input } = rule;
        for (let dz = 0; dz < IMZ; dz++)
            for (let dy = 0; dy < IMY; dy++)
                for (let dx = 0; dx < IMX; dx++) {
                    let sx = x + dx;
                    let sy = y + dy;
                    let sz = z + dz;

                    if (sx >= MX) sx -= MX;
                    if (sy >= MY) sy -= MY;
                    if (sz >= MZ) sz -= MZ;

                    const inputWave = input[dx + dy * IMX + dz * IMX * IMY];
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
        const { OMZ, OMY, OMX, output } = rule;

        for (let dz = 0; dz < OMZ; dz++)
            for (let dy = 0; dy < OMY; dy++)
                for (let dx = 0; dx < OMX; dx++) {
                    let sx = x + dx;
                    let sy = y + dy;
                    let sz = z + dz;

                    if (sx >= MX) sx -= MX;
                    if (sy >= MY) sy -= MY;
                    if (sz >= MZ) sz -= MZ;

                    const o = output[dx + dy * OMX + dz * OMX * OMY];
                    if (o != 0xff) state[sx + sy * MX + sz * MX * MY] = o;
                }
    }

    public override run() {
        if (this.n >= 0) return super.run();

        const grid = this.grid;
        const newgrid = this.newgrid;
        const [NX, NY, NZ, DX, DY, DZ] = this.ND;
        const { MZ, MY, MX, state } = grid;

        newgrid.clear();
        for (const rule of this.rules) {
            for (let z = 0; z < MZ; z++)
                for (let y = 0; y < MY; y++)
                    for (let x = 0; x < MX; x++)
                        if (MapNode.matches(rule, x, y, z, state, MX, MY, MZ))
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

        return RunState.SUCCESS;
    }

    public override reset() {
        super.reset();
        this.n = -1;
    }
}
