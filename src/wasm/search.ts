import seedrandom, { PRNG } from "seedrandom";
import { HashMap, PriorityQueue } from "../helpers/datastructures";
import { Helper } from "../helpers/helper";
import { Program } from "../program";
import { Rule } from "../rule";
import { Optimization } from "./optimization";

export class NativeSearch {
    public static *run(
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
        seed: number,
        viz?: boolean
    ): Generator<number, Uint8Array[]> {
        const lib = Optimization.obs_instance;
        lib.reset();

        const bin = lib.exports;

        const ptr_size: number = bin.ptr_size();
        const rule_ptrs = rules.map((r) => Optimization.load_rule(r));
        const rule_table = lib.malloc(rule_ptrs.length * ptr_size);
        // wasm32
        if (ptr_size === 4) {
            for (let i = 0; i < rule_ptrs.length; i++) {
                lib.view.setUint32(rule_table + i * 4, rule_ptrs[i], true);
            }
            // wasm64
        } else if (ptr_size === 8) {
            for (let i = 0; i < rule_ptrs.length; i++) {
                lib.view.setBigUint64(
                    rule_table + i * 8,
                    BigInt(rule_ptrs[i]),
                    true
                );
            }
        } else throw Error(`ptr_size = ${ptr_size}?????`);

        const elem = present.length;
        const rule_len = rules.length;

        const future_ptr = lib.malloc(future.byteLength);
        lib.copy_from_external(future, future_ptr);
        const state_ptr = lib.malloc(present.byteLength);
        lib.copy_from_external(present, state_ptr);

        const bp_ptr = lib.malloc(elem * C * Int32Array.BYTES_PER_ELEMENT);
        const fp_ptr = lib.malloc(elem * C * Int32Array.BYTES_PER_ELEMENT);

        const queue = bin.new_queue(
            4 * Uint16Array.BYTES_PER_ELEMENT,
            elem * C
        );
        const mask = bin.new_bool_2d(elem, rule_len);

        // const bpotentials = lib.typed_array(Int32Array, bp_ptr, elem * C);
        // const fpotentials = lib.typed_array(Int32Array, fp_ptr, elem * C);

        bin.compute_bd(
            bp_ptr,
            future_ptr,
            queue,
            mask,
            MX,
            MY,
            MZ,
            C,
            rule_table,
            rule_len
        );
        const rootBackwardEstimate = bin.bd_points(bp_ptr, state_ptr, C, elem);

        /*
        console.log("future: ");
        const fu = lib.typed_array(Int32Array, future_ptr, future.length);

        for (let y = 0; y < MY; y++) {
            let str = "";
            for (let x = 0; x < MX; x++) {
                str += fu[x + y * MX].toString().padStart(3, " ");
            }
            console.log(str);
        }
        */

        /*
        console.log("bpotentials:");
        for (let c = 0; c < C; c++) {
            console.log(`c = ${c}`);

            const row = bpotentials.subarray(elem * c, elem * (c + 1));

            for (let y = 0; y < MY; y++) {
                let str = "";
                for (let x = 0; x < MX; x++) {
                    str += row[x + y * MX].toString().padStart(3, " ");
                }
                console.log(str);
            }
            console.log();
        }
        */

        bin.compute_fd(
            fp_ptr,
            state_ptr,
            queue,
            mask,
            MX,
            MY,
            MZ,
            C,
            rule_table,
            rule_len
        );
        const rootForwardEstimate = bin.fd_points(fp_ptr, future_ptr, C, elem);

        /*
        console.log("fpotentials:");
        for (let c = 0; c < C; c++) {
            console.log(`c = ${c}`);

            const row = fpotentials.subarray(elem * c, elem * (c + 1));

            for (let y = 0; y < MY; y++) {
                let str = "";
                for (let x = 0; x < MX; x++) {
                    str += row[x + y * MX].toString().padStart(3, " ");
                }
                console.log(str);
            }
            console.log();
        }
        */

        console.log(
            `root estimate = (${rootBackwardEstimate}, ${rootForwardEstimate}), limit = ${limit}`
        );

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
            (a) => a,
            hashBytes,
            compareBytes
        );
        visited.set(present, 0);

        const frontier = new PriorityQueue<{ p: number; v: number }>(
            ({ p: p1 }, { p: p2 }) => p1 <= p2
        );
        const rng = seedrandom(seed.toString());
        frontier.enqueue({ v: 0, p: rootBoard.rank(rng, depthCoefficient) });

        const temp: { buffer: Uint8Array } = { buffer: null };

        let record = rootBackwardEstimate + rootForwardEstimate;
        let now = performance.now();

        const interval = setInterval(() => {
            // console.log(`queue length: ${frontier.size}`);
        }, 1000);

        while (frontier.size > 0 && (limit < 0 || database.length < limit)) {
            const parentIndex = frontier.dequeue().v;
            const parentBoard = database[parentIndex];

            if (all) {
                for (const childState of this.allChildStates(
                    parentBoard.state,
                    MX,
                    MY,
                    rules
                )) {
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
                        lib.copy_from_external(childState, state_ptr);
                        const childBackwardEstimate = bin.bd_points(
                            bp_ptr,
                            state_ptr,
                            C,
                            elem
                        );
                        bin.compute_fd(
                            fp_ptr,
                            state_ptr,
                            queue,
                            mask,
                            MX,
                            MY,
                            MZ,
                            C,
                            rule_table,
                            rule_len
                        );
                        const childForwardEstimate = bin.fd_points(
                            fp_ptr,
                            future_ptr,
                            C,
                            elem
                        );
                        if (
                            childBackwardEstimate < 0 ||
                            childForwardEstimate < 0
                        )
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

                        if (childForwardEstimate <= 0) {
                            const trajectory = Board.trajectory(
                                childIndex,
                                database
                            ).reverse();

                            if (viz)
                                Program.instance.renderer.forcedState = null;
                            yield visited.size;

                            clearInterval(interval);
                            return trajectory.map((b) => b.state);
                        } else {
                            if (
                                limit < 0 &&
                                childBackwardEstimate + childForwardEstimate <
                                    record
                            ) {
                                record =
                                    childBackwardEstimate +
                                    childForwardEstimate;
                                // const log = `found a state of record estimate ${record} = ${childBackwardEstimate} + ${childForwardEstimate}`;
                                // console.log(log);
                                // PrintState(childState, MX, MY);

                                if (viz)
                                    Program.instance.renderer.forcedState =
                                        childState;
                            }
                            frontier.enqueue({
                                v: childIndex,
                                p: childBoard.rank(rng, depthCoefficient),
                            });
                        }
                    }
                }
            } else {
                for (const childState of this.oneChildStates(
                    parentBoard.state,
                    MX,
                    MY,
                    rules,
                    temp
                )) {
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
                        temp.buffer = childState;
                    } else {
                        lib.copy_from_external(childState, state_ptr);
                        const childBackwardEstimate = bin.bd_points(
                            bp_ptr,
                            state_ptr,
                            C,
                            elem
                        );
                        bin.compute_fd(
                            fp_ptr,
                            state_ptr,
                            queue,
                            mask,
                            MX,
                            MY,
                            MZ,
                            C,
                            rule_table,
                            rule_len
                        );
                        const childForwardEstimate = bin.fd_points(
                            fp_ptr,
                            future_ptr,
                            C,
                            elem
                        );

                        if (
                            childBackwardEstimate < 0 ||
                            childForwardEstimate < 0
                        ) {
                            temp.buffer = childState;
                            continue;
                        }
                        temp.buffer = null;

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

                            if (viz)
                                Program.instance.renderer.forcedState = null;

                            yield visited.size;

                            clearInterval(interval);
                            return trajectory.map((b) => b.state);
                        } else {
                            if (
                                limit < 0 &&
                                childBackwardEstimate + childForwardEstimate <
                                    record
                            ) {
                                record =
                                    childBackwardEstimate +
                                    childForwardEstimate;

                                // const log = `found a state of record estimate ${record} = ${childBackwardEstimate} + ${childForwardEstimate}`;
                                // console.log(log);
                                // PrintState(childState, MX, MY);

                                if (viz) {
                                    Program.instance.renderer.forcedState =
                                        childState;
                                    yield visited.size;
                                }
                            }

                            frontier.enqueue({
                                v: childIndex,
                                p: childBoard.rank(rng, depthCoefficient),
                            });
                        }
                    }
                }
            }

            if (viz && performance.now() - now > 50) {
                yield visited.size;
                now = performance.now();
            }
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
        rules: Rule[],
        temp: { buffer: Uint8Array }
    ) {
        for (const rule of rules) {
            for (let y = 0; y < MY; y++)
                for (let x = 0; x < MX; x++)
                    if (Matches(rule, x, y, state, MX, MY))
                        yield Applied(rule, x, y, state, MX, temp.buffer);
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
    for (let di = 0; di < rule.input.length; di++) {
        if ((rule.input[di] & (1 << state[x + dx + (y + dy) * MX])) === 0)
            return false;
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
    MX: number,
    result: Uint8Array
) => {
    if (!result) result = new Uint8Array(state.length);

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
