import { action, makeObservable, observable, override } from "mobx";
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
    get name(): string {
        return "convchain";
    }

    constructor(source: ConvChainNode) {
        super(source);
        makeObservable(this);
    }

    @override
    sync() {}
}

export class ConvolutionState extends NodeState<ConvolutionNode> {
    get name(): string {
        return "convolution";
    }

    constructor(source: ConvolutionNode) {
        super(source);
        makeObservable(this);
    }

    @override
    sync() {}
}

export class MapState extends BranchState<MapNode> {
    get name(): string {
        return "map";
    }
}

export class PathState extends NodeState<PathNode> {
    constructor(source: PathNode) {
        super(source);
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

    constructor(source: T) {
        super(source);
        makeObservable(this);
    }

    @override
    sync() {
        this.steps = this.source.steps || -1;
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
