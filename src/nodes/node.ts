import { Grid } from "../grid";
import { SymmetryHelper } from "../helpers/symmetry";
import { Interpreter } from "../interpreter";
import { AllNode } from "./all";
import { ConvolutionNode } from "./convolution";
import { MapNode } from "./map";
import { OneNode } from "./one";
import { ParallelNode } from "./parallel";
import { PathNode } from "./path";
import { WFCNode } from "./wfc";

export abstract class Node {
    protected abstract load(elem: Element, symmetry: Uint8Array, grid: Grid);
    public abstract reset();
    public abstract run();

    protected ip: Interpreter;
    public grid: Grid;

    public static factory(
        elem: Element,
        symmetry: Uint8Array,
        ip: Interpreter,
        grid: Grid
    ) {
        const name = elem.tagName.toLowerCase();
        if (!Node.VALID_TAGS.includes(name)) {
            console.error(elem, `unknown node type: ${name}`);
            return null;
        }

        // TODO: implement all the nodes
        const result: Node = {
            one: () => new OneNode(),
            all: () => new AllNode(),
            prl: () => new ParallelNode(),
            markov: () => new MarkovNode(),
            sequence: () => new SequenceNode(),
            path: () => new PathNode(),
            map: () => new MapNode(),
            convolution: () => new ConvolutionNode(),
            convchain: () => null,
            wfc: () => {},
        }[name]();

        result.ip = ip;
        result.grid = grid;
        const success = result.load(elem, symmetry, grid);

        if (!success) return null;
        return result;
    }

    protected static VALID_TAGS = [
        "one",
        "all",
        "prl",
        "markov",
        "sequence",
        "path",
        "map",
        "convolution",
        "convchain",
        "wfc",
    ];
}

export abstract class Branch extends Node {
    public parent: Branch;
    public nodes: Node[];
    public n: number;

    protected override load(
        elem: Element,
        parentSymmetry: Uint8Array,
        grid: Grid
    ) {
        const symmetryString = elem.getAttribute("symmetry");
        const symmetry = SymmetryHelper.getSymmetry(
            this.ip.grid.MZ === 1,
            symmetryString,
            parentSymmetry
        );
        if (!symmetry) {
            console.error(elem, `unknown symmetry ${symmetryString}`);
            return false;
        }

        for (let i = 0; i < elem.children.length; i++) {
            const child = Node.factory(
                elem.children.item(i),
                symmetry,
                this.ip,
                grid
            );
            if (!child) return false;
            if (child instanceof Branch)
                child.parent =
                    child instanceof MapNode || child instanceof WFCNode
                        ? null
                        : this;
            this.nodes.push(child);
        }
        return true;
    }

    public override run() {
        for (; this.n < this.nodes.length; this.n++) {
            const node = this.nodes[this.n];
            if (node instanceof Branch) this.ip.current = this;
            if (node.run()) return true;
        }
        this.ip.current = this.ip.current.parent;
        this.reset();
        return false;
    }

    public override reset() {
        this.nodes.forEach((n) => n.reset());
        this.n = 0;
    }
}

export class SequenceNode extends Branch {}
export class MarkovNode extends Branch {
    constructor(child?: Node, ip?: Interpreter) {
        super();

        if (child) this.nodes = [child];
        this.ip = ip;
        this.grid = ip?.grid;
    }

    public override run() {
        this.n = 0;
        return super.run();
    }
}
