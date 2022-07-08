import { action, makeObservable, observable, override } from "mobx";
import { Helper } from "./helpers/helper";
import { Interpreter } from "./interpreter";
import {
    AllNode,
    ConvChainNode,
    ConvolutionNode,
    MapNode,
    OneNode,
    PathNode,
    WFCNode,
    RuleNode,
    SequenceNode,
    MarkovNode,
    Branch,
    Node,
    ParallelNode,
    TileNode,
    OverlapNode,
} from "./nodes";

export type NodeWithDepth = {
    node: Node;
    parent: NodeState;
    depth: number;
    index: number;
};
export type NodeStateInfo = {
    state: NodeState;
    parent: NodeState;
    depth: number;
    index: number;
    breakpoint: boolean;
};

export abstract class NodeState<T extends Node = Node> {
    public source: T;

    constructor(source: T) {
        this.source = source;
        makeObservable(this);
    }

    public static traverse(ip: Interpreter) {
        const visited: NodeStateInfo[] = [];
        const stack: NodeWithDepth[] = [
            { node: ip.root, depth: 0, index: 0, parent: null },
        ];

        while (stack.length) {
            const { node, depth, parent, index } = stack.pop();
            const state = this.factory(node);
            visited.push({ state, depth, index, parent, breakpoint: false });

            if (node instanceof Branch) {
                for (
                    let index = node.children.length - 1;
                    index >= 0;
                    index--
                ) {
                    stack.push({
                        node: node.children[index],
                        depth: depth + 1,
                        index,
                        parent: state,
                    });
                }
            }
        }

        return visited;
    }

    // well
    private static factory(node: Node): NodeState {
        if (node instanceof SequenceNode) return new SequenceState(node);
        if (node instanceof MarkovNode) return new MarkovState(node);
        if (node instanceof ConvolutionNode) return new ConvolutionState(node);
        if (node instanceof ConvChainNode) return new ConvChainState(node);
        if (node instanceof MapNode) return new MapState(node);
        if (node instanceof PathNode) return new PathState(node);
        if (node instanceof AllNode) return new AllState(node);
        if (node instanceof OneNode) return new OneState(node);
        if (node instanceof ParallelNode) return new ParallelState(node);
        if (node instanceof TileNode) return new TileState(node);
        if (node instanceof OverlapNode) return new OverlapState(node);

        console.error(node);
        throw new Error("unknown node");
        return null;
    }

    @action
    sync() {}

    abstract get name(): string;
}

abstract class BranchState<T extends Branch> extends NodeState<T> {
    @observable
    public index: number;

    constructor(source: T) {
        super(source);
        makeObservable(this);
    }

    @override
    override sync() {}
}

export class SequenceState extends BranchState<SequenceNode> {
    override get name() {
        return "sequence";
    }
}

export class MarkovState extends BranchState<MarkovNode> {
    get name(): string {
        return "markov";
    }
}

export class ConvChainState extends NodeState<ConvChainNode> {
    @observable
    public steps = -1;
    @observable
    public counter = 0;
    @observable
    public c0: number;
    @observable
    public c1: number;
    @observable
    public SMX: number;
    @observable
    public SMY: number;

    public readonly sample: Uint8Array;

    get name(): string {
        return "convchain";
    }

    constructor(source: ConvChainNode) {
        super(source);
        this.steps = this.source.steps || -1;
        this.c0 = this.source.c0;
        this.c1 = this.source.c1;
        this.SMX = this.source.SMX;
        this.SMY = this.source.SMY;

        this.sample = new Uint8Array(this.source.sample.length);
        this.sample.set(this.source.sample);

        makeObservable(this);
    }

    @override
    sync() {
        this.source.steps = this.steps;

        this.source.c0 = this.c0;
        this.source.c1 = this.c1;

        this.counter = this.source.counter || 0;
    }
}

export class ConvolutionState extends NodeState<ConvolutionNode> {
    @observable
    public steps = -1;
    @observable
    public counter = 0;

    get name(): string {
        return `convolution-${this.source.neighborhood.toLowerCase()}`;
    }

    constructor(source: ConvolutionNode) {
        super(source);
        this.steps = this.source.steps || -1;

        makeObservable(this);
    }

    @override
    sync() {
        this.source.steps = this.steps;
        this.counter = this.source.counter || 0;
    }
}

export class MapState extends BranchState<MapNode> {
    get name(): string {
        return "map";
    }
}

export class PathState extends NodeState<PathNode> {
    @observable
    public from: number[];
    @observable
    public to: number[];
    @observable
    public on: number[];
    @observable
    public colored: number;

    constructor(source: PathNode) {
        super(source);

        this.from = Helper.nonZeroPositions(source.start);
        this.to = Helper.nonZeroPositions(source.finish);
        this.on = Helper.nonZeroPositions(source.substrate);
        this.colored = source.value;

        makeObservable(this);
    }

    get name(): string {
        return "path";
    }

    @override
    sync() {}
}

export abstract class RuleState<T extends RuleNode> extends NodeState<T> {
    @observable
    public steps = -1;
    @observable
    public counter = 0;
    @observable
    public temperature: number;
    @observable
    public search: boolean;

    constructor(source: T) {
        super(source);

        this.temperature = this.source.temperature;
        this.search = this.source.search;
        this.steps = this.source.steps || -1;

        makeObservable(this);
    }

    @override
    sync() {
        this.source.steps = this.steps;
        this.counter = this.source.counter || 0;
    }
}

export class AllState extends RuleState<AllNode> {
    get name(): string {
        return "all";
    }
}

export class OneState extends RuleState<OneNode> {
    get name(): string {
        return "one";
    }
}

export class ParallelState extends RuleState<ParallelNode> {
    get name(): string {
        return "prl";
    }
}

export abstract class WFCState<T extends WFCNode> extends NodeState<T> {
    constructor(source: T) {
        super(source);
        makeObservable(this);
    }

    @override
    sync() {}
}

export class TileState extends WFCState<TileNode> {
    get name(): string {
        return `wfc-tile: ${this.source.name.toLowerCase()}`;
    }
}

export class OverlapState extends WFCState<OverlapNode> {
    get name(): string {
        return `wfc-overlap: ${this.source.name.toLowerCase()}`;
    }
}
