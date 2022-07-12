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
        dcoeff: number,
        seed: number,
        viz?: boolean
    ): Generator<number, Uint8Array[]> {
        const rng = seedrandom(seed.toString());

        const lib = Optimization.obs_instance;
        lib.reset();

        const bin = lib.exports;

        const ptr_size: number = bin.ptr_size();
        const board_size: number = bin.board_size();

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

        const zobrist_table_ptr = lib.malloc(
            elem * C * BigUint64Array.BYTES_PER_ELEMENT
        );
        {
            const zobrist_table = lib.typed_array(
                BigUint64Array,
                zobrist_table_ptr,
                elem * C
            );
            crypto.getRandomValues(zobrist_table);
        }

        const future_ptr = lib.malloc(future.byteLength);
        lib.copy_from_external(future, future_ptr);
        const state_ptr = lib.malloc(present.byteLength);
        lib.copy_from_external(present, state_ptr);

        const bp = lib.malloc(elem * C * Int16Array.BYTES_PER_ELEMENT);
        const fp = lib.malloc(elem * C * Int16Array.BYTES_PER_ELEMENT);

        const queue = bin.new_queue(
            4 * Uint16Array.BYTES_PER_ELEMENT,
            elem * C
        );
        const mask = bin.new_bool_2d(elem, rule_len);

        // const bpotentials = lib.typed_array(Int32Array, bp_ptr, elem * C);
        // const fpotentials = lib.typed_array(Int32Array, fp_ptr, elem * C);

        bin.compute_bd(
            bp,
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
        const rootBD = bin.bd_points(bp, state_ptr, C, elem);

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
            fp,
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
        const rootFD = bin.fd_points(fp, future_ptr, C, elem);

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

        console.log(`root estimate = (${rootBD}, ${rootFD}), limit = ${limit}`);

        if (rootBD < 0 || rootFD < 0) {
            console.error("INCORRECT PROBLEM");
            return null;
        }

        if (!rootBD) return [];

        let recordState: Uint8Array = null;
        let now = Date.now();

        const interval = setInterval(() => {
            // console.log(`queue length: ${frontier.size}`);
        }, 1000);

        if (all) {
            const rootBoard = new Board(present, -1, 0, rootBD, rootFD);
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
            frontier.enqueue({
                v: 0,
                p: rootBoard.rank(rng, dcoeff),
            });

            let record = rootBD + rootFD;
            const amounts = new Uint32Array(elem);

            while (
                frontier.size > 0 &&
                (limit < 0 || database.length < limit)
            ) {
                const parentIndex = frontier.dequeue().v;
                const parentBoard = database[parentIndex];

                for (const childState of this.allChildStates(
                    parentBoard.state,
                    MX,
                    MY,
                    rules,
                    amounts
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
                                    p: oldBoard.rank(rng, dcoeff),
                                });
                            }
                        }
                    } else {
                        lib.copy_from_external(childState, state_ptr);
                        const childBD = bin.bd_points(bp, state_ptr, C, elem);
                        bin.compute_fd(
                            fp,
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
                        const childFD = bin.fd_points(fp, future_ptr, C, elem);
                        if (childBD < 0 || childFD < 0) continue;
                        const childBoard = new Board(
                            childState,
                            parentIndex,
                            parentBoard.depth + 1,
                            childBD,
                            childFD
                        );
                        database.push(childBoard);
                        childIndex = database.length - 1;
                        visited.set(childBoard.state, childIndex);

                        if (childFD <= 0) {
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
                            if (limit < 0 && childBD + childFD < record) {
                                record = childBD + childFD;
                                recordState = childState;
                                // const log = `found a state of record estimate ${record} = ${childBD} + ${childFD}`;
                                // console.log(log);
                                // PrintState(childState, MX, MY);
                            }
                            frontier.enqueue({
                                v: childIndex,
                                p: childBoard.rank(rng, dcoeff),
                            });
                        }
                    }
                }

                if (viz && Date.now() - now > 50) {
                    Program.instance.renderer.forcedState = recordState;

                    yield visited.size;
                    now = Date.now();
                }
            }
        } else {
            const traverse = (board_ptr: number) => {
                const result: number[] = [];
                while (board_ptr) {
                    result.push(board_ptr + board_size);
                    board_ptr = bin.board_get_parent(board_ptr);
                }
                return result;
            };

            // Map state buffer (ptr) to board (ptr)
            const visited = new HashMap<number, number>(
                (a) => a,
                null,
                (ptr1, ptr2) => bin.eq(ptr1, ptr2, elem)
            );
            // p is priority, v is board (ptr)
            const frontier = new PriorityQueue<{ p: number; v: number }>(
                ({ p: p1 }, { p: p2 }) => p1 <= p2
            );

            const push_board = (ptr: number) =>
                frontier.enqueue({
                    v: ptr,
                    p: bin.board_rank(ptr, rng.double(), dcoeff),
                });

            const root_board = bin.new_board(elem);
            const bytes = board_size + elem;
            const aligned = bytes & 3 ? bytes + ((4 - bytes) & 3) : bytes;
            const board_index = (ptr: number) => (ptr - root_board) / aligned;

            {
                bin.board_init(root_board, rootBD, rootFD, 0);

                const root_state = root_board + board_size;
                lib.copy_from_external(present, root_state);

                const hash = bin.hash(root_state);
                visited.set(root_state, root_board, hash);

                push_board(root_board);
            }

            let record = rootBD + rootFD;
            let boards = 1;

            const temp_board = { ptr: <number>bin.new_board(elem) };

            while (frontier.size > 0 && (limit < 0 || boards < limit)) {
                const parent_board = frontier.dequeue().v;
                const parent_state = parent_board + board_size;

                const result = this.oneChildStates(
                    parent_state,
                    MX,
                    MY,
                    elem,
                    rule_ptrs,
                    temp_board,
                    () => {
                        const temp_state = temp_board.ptr + board_size;

                        const hash = bin.hash(
                            temp_state,
                            zobrist_table_ptr,
                            elem
                        );

                        const visited_board = visited.greedy_get(hash, (k) =>
                            bin.eq(k, temp_state, elem)
                        );

                        if (visited_board !== null) {
                            const parent_depth = bin.board_depth(parent_board);
                            const visited_board_depth =
                                bin.board_depth(visited_board);

                            if (parent_depth + 1 < visited_board_depth) {
                                bin.board_set_parent(
                                    visited_board,
                                    parent_board
                                );

                                push_board(visited_board);
                            }
                        } else {
                            const childBD = bin.bd_points(
                                bp,
                                temp_state,
                                C,
                                elem
                            );
                            bin.compute_fd(
                                fp,
                                temp_state,
                                queue,
                                mask,
                                MX,
                                MY,
                                MZ,
                                C,
                                rule_table,
                                rule_len
                            );
                            const childFD = bin.fd_points(
                                fp,
                                future_ptr,
                                C,
                                elem
                            );

                            if (childBD < 0 || childFD < 0) return null;

                            const child_board = temp_board.ptr;
                            const child_state = child_board + board_size;

                            temp_board.ptr = bin.new_board(elem);
                            boards++;

                            bin.board_init(
                                child_board,
                                childBD,
                                childFD,
                                parent_board
                            );
                            visited.set(child_state, child_board, hash);

                            if (childFD === 0) {
                                const path = traverse(child_board).reverse();

                                if (viz)
                                    Program.instance.renderer.forcedState =
                                        null;

                                return path.map((ptr) =>
                                    lib.typed_array(Uint8Array, ptr, elem)
                                );
                            } else {
                                if (limit < 0 && childBD + childFD < record) {
                                    record = childBD + childFD;

                                    // Can't just ref view here, might get detached
                                    recordState = lib.copy_to_external(
                                        child_state,
                                        new Uint8Array(elem)
                                    );

                                    // const log = `found a state of record estimate ${record} = ${childBackwardEstimate} + ${childForwardEstimate}`;
                                    // console.log(log);
                                    // PrintState(childState, MX, MY);
                                }

                                push_board(child_board);
                            }
                        }

                        return null;
                    }
                );

                if (result) return result;

                if (viz && Date.now() - now > 50) {
                    Program.instance.renderer.forcedState = recordState;

                    yield visited.size;
                    now = Date.now();
                }
            }
        }

        return null;
    }

    public static allChildStates(
        state: Uint8Array,
        MX: number,
        MY: number,
        rules: Rule[],
        amounts: Uint32Array
    ) {
        const list: [Rule, number][] = [];
        amounts.fill(0);

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

    private static oneChildStates(
        parent_ptr: number,
        MX: number,
        MY: number,
        elem: number,
        rule_ptrs: number[],
        temp_board: { ptr: number },
        cb: () => Uint8Array[]
    ) {
        const lib = Optimization.obs_instance;
        const bin = lib.exports;
        const board_size = bin.board_size();

        for (let y = 0; y < MY; y++) {
            for (let x = 0; x < MX; x++) {
                for (let r = 0; r < rule_ptrs.length; r++) {
                    const rule_ptr = rule_ptrs[r];
                    if (
                        bin.match_and_apply(
                            rule_ptr,
                            x,
                            y,
                            MX,
                            MY,
                            elem,
                            parent_ptr,
                            temp_board.ptr + board_size
                        )
                    ) {
                        const result = cb();
                        if (result) return result;
                    }
                }
            }
        }

        return null;
    }

    private static enumerate(
        children: Uint8Array[],
        solution: [Rule, number][],
        tiles: [Rule, number][],
        amounts: Uint32Array,
        mask: Uint8Array,
        state: Uint8Array,
        MX: number
    ) {
        const I = Helper.maxPositiveIndex(amounts);

        if (I < 0) {
            children.push(ApplySolution(state, solution, MX));
            return;
        }

        const X = I % MX,
            Y = ~~(I / MX);

        const cover: [Rule, number][] = [];
        for (let l = 0; l < tiles.length; l++) {
            const [rule, i] = tiles[l];
            if (mask[l] && IsInside(X, Y, rule, i % MX, ~~(i / MX)))
                cover.push([rule, i]);
        }

        for (const [rule1, i1] of cover) {
            solution.push([rule1, i1]);

            const intersecting: number[] = [];
            for (let l = 0; l < tiles.length; l++)
                if (mask[l]) {
                    const [rule2, i2] = tiles[l];
                    if (
                        Overlap(
                            rule1,
                            i1 % MX,
                            ~~(i1 / MX),
                            rule2,
                            i2 % MX,
                            ~~(i2 / MX)
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
    "-",
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

const StateToString = (state: Uint8Array, MX: number, MY: number) => {
    const row: string[] = [];
    for (let y = 0; y < MY; y++) {
        const str: string[] = [];
        for (let x = 0; x < MX; x++) str.push(chars[state[x + y * MX]]);
        row.push(str.join(""));
    }
    return row.join("\n");
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
    amounts: Uint32Array,
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
