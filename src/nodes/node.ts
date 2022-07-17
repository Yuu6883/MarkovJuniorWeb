import { Grid } from "../grid";
import { Helper } from "../helpers/helper";
import { SymmetryHelper } from "../helpers/symmetry";
import { Interpreter } from "../interpreter";

import {
    AllNode,
    ConvChainNode,
    ConvolutionNode,
    MapNode,
    OneNode,
    OverlapNode,
    ParallelNode,
    PathNode,
    RunState,
    TileNode,
    WFCNode,
} from "./";

interface NodeConstructor {
    new (): Node;
}

export abstract class Node {
    public abstract load(
        elem: Element,
        symmetry: Uint8Array,
        grid: Grid
    ): Promise<boolean>;

    public abstract reset(): void;
    public abstract run(): RunState;

    public source: Element;
    public comment: string;
    public sync: boolean;

    public ip: Interpreter;
    public grid: Grid;

    public static async factory(
        elem: Element,
        symmetry: Uint8Array,
        ip: Interpreter,
        grid: Grid
    ) {
        const name = elem.tagName.toLowerCase();
        if (!Node.VALID_TAGS.has(name)) {
            console.error(elem, `unknown node type: ${name}`);
            return null;
        }

        const node: Node = {
            one: () => new OneNode(),
            all: () => new AllNode(),
            prl: () => new ParallelNode(),
            and: () => new AndNode(),
            scope: () => new ScopeNode(),
            markov: () => new MarkovNode(),
            sequence: () => new SequenceNode(),
            path: () => new PathNode(),
            map: () => new MapNode(),
            convolution: () => new ConvolutionNode(),
            convchain: () => new ConvChainNode(),
            wfc: () => {
                if (elem.getAttribute("sample")) return new OverlapNode();
                if (elem.getAttribute("tileset")) return new TileNode();
                return null;
            },
            ...Node.EXT,
        }[name]();

        node.ip = ip;
        node.grid = grid;
        node.source = elem;
        node.comment = elem.getAttribute("comment");
        node.sync = elem.getAttribute("sync") === "True";

        const success = await node.load(elem, symmetry, grid);
        if (!success) console.error(elem, "failed to load");

        return success ? node : null;
    }

    private static readonly VALID_TAGS = new Set([
        "one",
        "all",
        "prl",
        "and",
        "scope",
        "markov",
        "sequence",
        "path",
        "map",
        "convolution",
        "convchain",
        "wfc",
    ]);

    private static readonly EXT: { [tag: string]: () => Node } = {};
    public static registerExt(name: string, type: NodeConstructor) {
        if (this.VALID_TAGS.has(name))
            throw new Error(`Tag <${name}> already exists`);
        this.VALID_TAGS.add(name);
        this.EXT[name] = () => new type();
    }

    public static isValidTag(tag: string) {
        return this.VALID_TAGS.has(tag);
    }
}

export abstract class Branch<T extends Node = Node> extends Node {
    public parent: Branch;
    public readonly children: T[] = [];
    public n: number;

    public override async load(
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

        const tasks: Promise<Node>[] = [];
        for (const child of Helper.collectionIter(elem.children)) {
            if (!Node.isValidTag(child.tagName)) continue;
            tasks.push(
                (async () => {
                    const node = await Node.factory(
                        child,
                        symmetry,
                        this.ip,
                        grid
                    );
                    if (!node) return null;
                    if (node instanceof Branch) {
                        node.parent =
                            node instanceof MapNode || node instanceof WFCNode
                                ? null
                                : this;
                    }
                    return node;
                })()
            );
        }
        const nodes = await Promise.all(tasks);
        if (nodes.some((n) => !n)) return false;
        (<Node[]>this.children).splice(0, this.children.length, ...nodes);
        return true;
    }

    public override reset() {
        this.children.forEach((n) => n.reset());
        this.n = 0;
    }
}

export class SequenceNode<T extends Node = Node> extends Branch<T> {
    public override run() {
        for (; this.n < this.children.length; this.n++) {
            const node = this.children[this.n];

            if (node instanceof Branch) {
                if (!(node instanceof ScopeNode)) this.ip.current = node;
            } else {
                this.ip.blocking = this.sync || node.sync;
            }

            const status = node.run();
            if (status === RunState.SUCCESS || status === RunState.HALT)
                return status;
        }
        this.ip.current = this.ip.current.parent;
        this.reset();
        return RunState.FAIL;
    }
}

export class MarkovNode<T extends Node = Node> extends Branch<T> {
    constructor(child?: Node, ip?: Interpreter) {
        super();

        if (child) (<Node[]>this.children).push(child);
        this.ip = ip;
        this.grid = ip?.grid;
    }

    public override run() {
        this.n = 0;
        return SequenceNode.prototype.run.apply(this);
    }
}

export class ScopeNode<T extends Node = Node> extends Branch<T> {
    public override run(): RunState {
        const { current } = this.ip;
        for (; this.n < this.children.length; this.n++) {
            const node = this.children[this.n];

            if (node instanceof Branch) {
                if (!(node instanceof ScopeNode)) this.ip.current = node;
            } else {
                this.ip.blocking = this.sync || node.sync;
            }

            const status: RunState = node.run();
            if (status === RunState.SUCCESS || status === RunState.HALT)
                return status;
        }
        this.ip.current = current;
        while (this.ip.current instanceof ScopeNode)
            this.ip.current = this.ip.current.parent;
        this.reset();
        return RunState.FAIL;
    }
}

export class AndNode extends Branch {
    private nextBreak = true;

    public override run() {
        for (; this.n < this.children.length; this.n++) {
            const node = this.children[this.n];
            if (node instanceof Branch) this.ip.current = node;
            const status = node.run();

            if (status === RunState.SUCCESS || status === RunState.HALT) {
                this.nextBreak = false;
                return status;
            }

            if (this.nextBreak) break;
            else this.nextBreak = true;
        }
        this.ip.current = this.ip.current.parent;
        this.reset();
        return RunState.FAIL;
    }

    public override reset() {
        this.nextBreak = true;
        super.reset();
    }
}
