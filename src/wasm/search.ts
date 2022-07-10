import seedrandom, { PRNG } from "seedrandom";
import { WasmInstance } from ".";
import { HashMap, PriorityQueue } from "../helpers/datastructures";
import { Helper } from "../helpers/helper";
import { Rule } from "../rule";

import type {
    new_queue as new_queue_t,
    new_bool_2d as new_bool_2d_t,
    new_potential as new_potential_t,
    potential_fill as potential_fill_t,
    compute_fd_potential as compute_fd_potential_t,
    compute_bd_potential as compute_bd_potential_t,
    fd_pointwise as fd_pointwise_t,
    bd_pointwise as bd_pointwise_t,
} from "./as/observation";

export class NativeSearch {
    public static *run(
        lib: WasmInstance,
        present: Uint8Array,
        future: Int32Array,
        rules: Rule[],
        MX: number,
        MY: number,
        MZ: number,
        C: number,
        all: boolean,
        limit: number,
        depthCoefficient: number,
        seed: number
    ): Generator<number, Uint8Array[]> {
        const PL = present.length;

        const {
            new_queue,
            new_bool_2d,
            new_potential,
            potential_fill,
            compute_fd_potential,
            compute_bd_potential,
            fd_pointwise,
            bd_pointwise,
        }: {
            new_queue: typeof new_queue_t;
            new_bool_2d: typeof new_bool_2d_t;
            new_potential: typeof new_potential_t;
            potential_fill: typeof potential_fill_t;
            compute_fd_potential: typeof compute_fd_potential_t;
            compute_bd_potential: typeof compute_bd_potential_t;
            fd_pointwise: typeof fd_pointwise_t;
            bd_pointwise: typeof bd_pointwise_t;
        } = lib.exports;

        lib.reset();

        const present_ptr = lib.malloc(PL);
        lib.copy_from_external(present, present_ptr);

        const temp_state_ptr = lib.malloc(PL);
        const temp_state_ptr_parent = lib.malloc(PL);

        const future_ptr = lib.malloc(future.byteLength);
        lib.copy_from_external(future, future_ptr);

        const bpotentials = new_potential(PL, C);
        potential_fill(bpotentials, -1);

        const fpotentials = new_potential(PL, C);
        potential_fill(fpotentials, -1);

        const queue = new_queue(16, PL * C);
        const mask = new_bool_2d(PL, rules.length);

        console.log(
            `
present_ptr = ${present_ptr},
future_ptr = ${future_ptr},
bpotentials = ${bpotentials},
fpotentials = ${fpotentials},
queue = ${queue},
mask = ${mask}`
        );

        compute_bd_potential(bpotentials, queue, mask, future_ptr, MX, MY, MZ);
        const rootBackwardEstimate = bd_pointwise(bpotentials, present_ptr);

        compute_fd_potential(fpotentials, queue, mask, present_ptr, MX, MY, MZ);
        const rootForwardEstimate = fd_pointwise(fpotentials, future_ptr);

        // console.log(
        //     `root estimate = (${rootBackwardEstimate}, ${rootForwardEstimate})`
        // );

        if (rootBackwardEstimate < 0 || rootForwardEstimate < 0) {
            console.error("INCORRECT PROBLEM");
            return null;
        }

        if (!rootBackwardEstimate) return [];
        const rootBoard = new Board(
            present,
            -1,
            0,
            rootBackwardEstimate,
            rootForwardEstimate
        );

        const database = [rootBoard];
        const visited = new HashMap<Uint8Array, number>(
            (a) => a.slice(),
            hashBytes,
            compareBytes
        );
        visited.set(present, 0);

        const frontier = new PriorityQueue<{ p: number; v: number }>(
            ({ p: p1 }, { p: p2 }) => p1 <= p2
        );
        const rng = seedrandom(seed.toString());
        frontier.enqueue({ v: 0, p: rootBoard.rank(rng, depthCoefficient) });

        let record = rootBackwardEstimate + rootForwardEstimate;

        while (frontier.size > 0 && (limit < 0 || database.length < limit)) {
            const parentIndex = frontier.dequeue().v;
            const parentBoard = database[parentIndex];

            lib.copy_from_external(parentBoard.state, temp_state_ptr_parent);

            const children = all
                ? this.allChildStates(parentBoard.state, MX, MY, rules)
                : this.oneChildStates(parentBoard.state, MX, MY, rules);

            for (const childState of children) {
                let childIndex = visited.get(childState);

                if (childIndex in database) {
                    const oldBoard = database[childIndex];
                    if (parentBoard.depth + 1 < oldBoard.depth) {
                        oldBoard.depth = parentBoard.depth + 1;
                        oldBoard.parentIndex = parentIndex;

                        if (
                            oldBoard.backwardEstimate >= 0 &&
                            oldBoard.forwardEstimate >= 0
                        ) {
                            frontier.enqueue({
                                v: childIndex,
                                p: oldBoard.rank(rng, depthCoefficient),
                            });
                        }
                    }
                } else {
                    lib.copy_from_external(childState, temp_state_ptr);
                    const childBackwardEstimate = bd_pointwise(
                        bpotentials,
                        temp_state_ptr
                    );
                    compute_fd_potential(
                        fpotentials,
                        queue,
                        mask,
                        temp_state_ptr,
                        MX,
                        MY,
                        MZ
                    );
                    const childForwardEstimate = fd_pointwise(
                        fpotentials,
                        future_ptr
                    );

                    if (childBackwardEstimate < 0 || childForwardEstimate < 0)
                        continue;

                    const childBoard = new Board(
                        childState,
                        parentIndex,
                        parentBoard.depth + 1,
                        childBackwardEstimate,
                        childForwardEstimate
                    );
                    database.push(childBoard);
                    childIndex = database.length - 1;
                    visited.set(childBoard.state, childIndex);

                    if (childForwardEstimate === 0) {
                        const trajectory = Board.trajectory(
                            childIndex,
                            database
                        ).reverse();

                        yield visited.size;
                        return trajectory.map((b) => b.state);
                    } else {
                        if (
                            limit < 0 &&
                            childBackwardEstimate + childForwardEstimate <=
                                record
                        ) {
                            record =
                                childBackwardEstimate + childForwardEstimate;

                            const log = `found a state of record estimate ${record} = ${childBackwardEstimate} + ${childForwardEstimate}`;
                            console.debug(log);
                            // PrintState(childState, MX, MY);
                        }

                        frontier.enqueue({
                            v: childIndex,
                            p: childBoard.rank(rng, depthCoefficient),
                        });
                    }
                }
            }

            yield visited.size;
        }

        return null;
    }

    public static allChildStates(
        state: Uint8Array,
        MX: number,
        MY: number,
        rules: Rule[]
    ) {
        const list: [Rule, number][] = [];
        const amounts = new Int32Array(state.length);

        for (let i = 0; i < state.length; i++) {
            const x = i % MX,
                y = ~~(i / MX);
            for (const rule of rules) {
                if (MatchRule(rule, x, y, state, MY, MY)) {
                    list.push([rule, i]);
                    for (let dy = 0; dy < rule.IMY; dy++)
                        for (let dx = 0; dx < rule.IMX; dx++)
                            amounts[x + dx + (y + dy) * MX]++;
                }
            }
        }

        const tiles = list.concat([]);
        const mask = new Uint8Array(tiles.length);
        mask.fill(1);

        const solution: [Rule, number][] = [];
        const result: Uint8Array[] = [];

        this.enumerate(result, solution, tiles, amounts, mask, state, MX);
        return result;
    }

    private static *oneChildStates(
        state: Uint8Array,
        MX: number,
        MY: number,
        rules: Rule[]
    ) {
        for (const rule of rules) {
            for (let y = 0; y < MY; y++)
                for (let x = 0; x < MX; x++)
                    if (Matches(rule, x, y, state, MX, MY))
                        yield Applied(rule, x, y, state, MX);
        }
    }

    private static enumerate(
        children: Uint8Array[],
        solution: [Rule, number][],
        tiles: [Rule, number][],
        amounts: Int32Array,
        mask: Uint8Array,
        state: Uint8Array,
        MX: number
    ) {
        const I = Helper.maxPositiveIndex(amounts);
        const X = I % MX,
            Y = ~~(I / MX);
        if (I < 0) {
            children.push(ApplySolution(state, solution, MX));
            return;
        }

        const cover: [Rule, number][] = [];
        for (let l = 0; l < tiles.length; l++) {
            const [rule, i] = tiles[l];
            if (mask[l] && IsInside(X, Y, rule, i % MX, ~~(i / MX)))
                cover.push([rule, i]);
        }

        for (const [rule, i] of cover) {
            solution.push([rule, i]);

            const intersecting: number[] = [];
            for (let l = 0; l < tiles.length; l++)
                if (mask[l]) {
                    const [rule1, i1] = tiles[l];
                    if (
                        Overlap(
                            rule,
                            i % MX,
                            ~~(i / MX),
                            rule1,
                            i1 % MX,
                            ~~(i1 / MX)
                        )
                    )
                        intersecting.push(l);
                }

            for (const l of intersecting)
                Hide(l, false, tiles, amounts, mask, MX);
            this.enumerate(children, solution, tiles, amounts, mask, state, MX);
            for (const l of intersecting)
                Hide(l, true, tiles, amounts, mask, MX);

            solution.pop();
        }
    }
}

const chars = [
    ".",
    "R",
    "W",
    "#",
    "a",
    "!",
    "?",
    "%",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
];

const PrintState = (state: Uint8Array, MX: number, MY: number) => {
    for (let y = 0; y < MY; y++) {
        const str: string[] = [];
        for (let x = 0; x < MX; x++) str.push(chars[state[x + y * MX]]);
        console.log(str.join(""));
    }
};

const Matches = (
    rule: Rule,
    x: number,
    y: number,
    state: Uint8Array,
    MX: number,
    MY: number
) => {
    if (x + rule.IMX > MX || y + rule.IMY > MY) return false;

    let dy = 0,
        dx = 0;
    for (const i of rule.input) {
        if ((i & (1 << state[x + dx + (y + dy) * MX])) === 0) return false;
        dx++;
        if (dx === rule.IMX) {
            dx = 0;
            dy++;
        }
    }
    return true;
};

const Applied = (
    rule: Rule,
    x: number,
    y: number,
    state: Uint8Array,
    MX: number
) => {
    const result = new Uint8Array(state.length);
    result.set(state);
    for (let dz = 0; dz < rule.OMZ; dz++)
        for (let dy = 0; dy < rule.OMY; dy++)
            for (let dx = 0; dx < rule.OMX; dx++) {
                const newValue =
                    rule.output[dx + dy * rule.OMX + dz * rule.OMX * rule.OMY];
                if (newValue != 0xff) result[x + dx + (y + dy) * MX] = newValue;
            }
    return result;
};

const MatchRule = (
    rule: Rule,
    x: number,
    y: number,
    state: Uint8Array,
    MX: number,
    MY: number
) => {
    if (x + rule.IMX > MX || y + rule.IMY > MY) return false;
    let dy = 0,
        dx = 0;
    for (let di = 0; di < rule.input.length; di++) {
        if ((rule.input[di] & (1 << state[x + dx + (y + dy) * MX])) == 0)
            return false;
        dx++;
        if (dx == rule.IMX) {
            dx = 0;
            dy++;
        }
    }
    return true;
};

const Hide = (
    l: number,
    unhide: boolean,
    tiles: [Rule, number][],
    amounts: Int32Array,
    mask: Uint8Array,
    MX: number
) => {
    mask[l] = unhide ? 1 : 0;
    const [rule, i] = tiles[l];
    const x = i % MX,
        y = ~~(i / MX);
    const incr = unhide ? 1 : -1;
    for (let dy = 0; dy < rule.IMY; dy++)
        for (let dx = 0; dx < rule.IMX; dx++)
            amounts[x + dx + (y + dy) * MX] += incr;
};

const ApplyRule = (
    rule: Rule,
    x: number,
    y: number,
    state: Uint8Array,
    MX: number
) => {
    for (let dy = 0; dy < rule.OMY; dy++)
        for (let dx = 0; dx < rule.OMX; dx++)
            state[x + dx + (y + dy) * MX] = rule.output[dx + dy * rule.OMX];
};

const ApplySolution = (
    state: Uint8Array,
    solution: [Rule, number][],
    MX: number
) => {
    const result = new Uint8Array(state.length);
    result.set(state);
    for (const [rule, i] of solution)
        ApplyRule(rule, i % MX, ~~(i / MX), result, MX);
    return result;
};

const IsInside = (x1: number, y1: number, rule: Rule, x2: number, y2: number) =>
    x2 <= x1 && x1 < x2 + rule.IMX && y2 <= y1 && y1 < y2 + rule.IMY;

const Overlap = (
    rule0: Rule,
    x0: number,
    y0: number,
    rule1: Rule,
    x1: number,
    y1: number
) => {
    for (let dy = 0; dy < rule0.IMY; dy++)
        for (let dx = 0; dx < rule0.IMX; dx++)
            if (IsInside(x0 + dx, y0 + dy, rule1, x1, y1)) return true;
    return false;
};

class Board {
    public readonly state: Uint8Array;
    public parentIndex: number;
    public depth: number;
    public readonly backwardEstimate: number;
    public readonly forwardEstimate: number;

    constructor(
        state: Uint8Array,
        parentIndex: number,
        depth: number,
        backwardEstimate: number,
        forwardEstimate: number
    ) {
        this.state = state;
        this.parentIndex = parentIndex;
        this.depth = depth;
        this.backwardEstimate = backwardEstimate;
        this.forwardEstimate = forwardEstimate;
    }

    public rank(rng: PRNG, depthCoefficient: number) {
        const result =
            depthCoefficient < 0.0
                ? 1000 - this.depth
                : this.forwardEstimate +
                  this.backwardEstimate +
                  2.0 * depthCoefficient * this.depth;
        return result + 0.0001 * rng.double();
    }

    // Path trace
    public static trajectory(index: number, database: Board[]) {
        const result: Board[] = [];
        for (
            let board = database[index];
            board.parentIndex >= 0;
            board = database[board.parentIndex]
        )
            result.push(board);
        return result;
    }
}

const compareBytes = (a: Uint8Array, b: Uint8Array) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
};

const tempInt = new Int32Array(1);

const hashBytes = (a: Uint8Array) => {
    tempInt[0] = 17;
    for (let i = 0; i < a.length; i++) tempInt[0] = tempInt[0] * 29 + a[i];
    return tempInt[0];
};
