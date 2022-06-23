import seedrandom, { PRNG } from "seedrandom";
import { Grid } from "./grid";
import { vec3 } from "./helpers/helper";
import { SymmetryHelper } from "./helpers/symmetry";
import { Node, Branch, MarkovNode } from "./nodes/";

export class Interpreter {
    public root: Branch;
    public current: Branch;

    public grid: Grid;
    public startgrid: Grid;

    origin: boolean;
    public rng: PRNG;

    public readonly changes: vec3[] = [];
    public readonly first: number[] = [];
    public counter = 0;
    public gif: boolean;

    public static async load(
        elem: Element,
        MX: number,
        MY: number,
        MZ: number
    ) {
        const ip = new Interpreter();
        ip.origin = elem.getAttribute("origin") === "True";
        ip.grid = Grid.build(elem, MX, MY, MZ);
        if (!ip.grid) {
            console.error("Failed to load grid");
            return null;
        }
        ip.startgrid = ip.grid;

        const symmetryString = elem.getAttribute("symmetry");

        const dflt = new Uint8Array(ip.grid.MZ === 1 ? 8 : 48);
        dflt.fill(1);

        const symmetry = SymmetryHelper.getSymmetry(
            ip.grid.MZ === 1,
            symmetryString,
            dflt
        );
        if (!symmetry) {
            console.error(elem, `unknown symmetry ${symmetryString}`);
            return null;
        }

        const topnode = await Node.factory(elem, symmetry, ip, ip.grid);
        if (!topnode) return null;
        ip.root =
            topnode instanceof Branch ? topnode : new MarkovNode(topnode, ip);
        return ip;
    }

    public *run(
        seed: number,
        steps: number,
        gif: boolean
    ): Generator<[Uint8Array, string, number, number, number]> {
        this.rng = seedrandom(seed.toString());
        const grid = (this.grid = this.startgrid);
        grid.clear();

        if (this.origin) {
            const center =
                ~~(grid.MX / 2) +
                ~~(grid.MY / 2) * grid.MX +
                ~~(grid.MZ / 2) * grid.MX * grid.MY;
            grid.state[center] = 1;
        }

        this.changes.splice(0, this.changes.length);
        this.first.splice(0, this.first.length);
        this.first.push(0);

        this.root.reset();
        this.current = this.root;

        this.gif = gif;
        this.counter = 0;

        while (this.current && (steps <= 0 || this.counter < steps)) {
            if (gif) {
                console.log(`[${this.counter}/${steps}]`);
                yield [grid.state, grid.characters, grid.MX, grid.MY, grid.MZ];
            }

            this.current.run();
            this.counter++;
            this.first.push(this.changes.length);
        }

        yield [grid.state, grid.characters, grid.MX, grid.MY, grid.MZ];
    }
}
