import seedrandom, { PRNG } from "seedrandom";
import { Grid } from "./grid";
import { vec3 } from "./helpers/helper";
import { SymmetryHelper } from "./helpers/symmetry";
import { Node, Branch, MarkovNode, WFCNode, EventNode } from "./nodes/";

export class Interpreter {
    public root: Branch;
    public current: Branch;
    public listener: EventNode;
    public blocking = false;

    public grid: Grid;
    public startgrid: Grid;

    origin: boolean;
    public rng: PRNG;
    public time = 0;

    public readonly changes: vec3[] = [];
    public readonly first: number[] = [];
    public counter = 0;

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
        steps: number
    ): Generator<[Uint8Array, string, number, number, number]> {
        this.rng = seedrandom(seed.toString());
        this.grid = this.startgrid;
        this.grid.clear();

        if (this.origin) {
            const center =
                ~~(this.grid.MX / 2) +
                ~~(this.grid.MY / 2) * this.grid.MX +
                ~~(this.grid.MZ / 2) * this.grid.MX * this.grid.MY;
            this.grid.state[center] = 1;
        }

        this.changes.splice(0, this.changes.length);
        this.first.splice(0, this.first.length);
        this.first.push(0);

        this.time = 0;
        this.root.reset();
        this.current = this.root;

        this.counter = 0;

        while (this.current && (steps <= 0 || this.counter < steps)) {
            if (!this.blocking)
                yield [
                    this.grid.state,
                    this.grid.characters,
                    this.grid.MX,
                    this.grid.MY,
                    this.grid.MZ,
                ];

            this.current.run();
            this.increChanges();
        }

        yield [
            this.grid.state,
            this.grid.characters,
            this.grid.MX,
            this.grid.MY,
            this.grid.MZ,
        ];
    }

    public increChanges() {
        this.counter++;
        this.first.push(this.changes.length);
    }

    public onRender() {
        if (this.current instanceof WFCNode && this.current.n < 0) {
            this.current.updateState();
        }
    }

    public state(): [Uint8Array, string, number, number, number] {
        const grid = this.grid;
        return [grid.state, grid.characters, grid.MX, grid.MY, grid.MZ];
    }
}
