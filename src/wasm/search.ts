import seedrandom from "seedrandom";
import { HashMap, PriorityQueue } from "../helpers/datastructures";
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
        const {
            new_queue,
            new_bool_2d,
            compute_bd,
            compute_fd,
            bd_points,
            fd_points,
            new_board,
            board_init,
            board_get_parent,
            board_rank,
            board_depth,
            board_set_parent,
            match_and_apply,
            eq,
            hash,
        }: { [key: string]: Function } = bin;

        const ptr_size: number = bin.ptr_size();
        const board_size: number = bin.board_size();

        const rule_ptrs = rules.map((r) => Optimization.load_rule(r));
        const rule_tbl = lib.malloc(rule_ptrs.length * ptr_size);
        // wasm32
        if (ptr_size === 4) {
            for (let i = 0; i < rule_ptrs.length; i++) {
                lib.view.setUint32(rule_tbl + i * 4, rule_ptrs[i], true);
            }
            // wasm64
        } else if (ptr_size === 8) {
            for (let i = 0; i < rule_ptrs.length; i++) {
                lib.view.setBigUint64(
                    rule_tbl + i * 8,
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

        const amounts_ptr = lib.malloc(elem * Int32Array.BYTES_PER_ELEMENT);

        const future_ptr = lib.malloc(future.byteLength);
        lib.copy_from_external(future, future_ptr);
        const state = lib.malloc(present.byteLength);
        lib.copy_from_external(present, state);

        const bp = lib.malloc(elem * C * Int16Array.BYTES_PER_ELEMENT);
        const fp = lib.malloc(elem * C * Int16Array.BYTES_PER_ELEMENT);

        const queue = new_queue(4 * Uint16Array.BYTES_PER_ELEMENT, elem * C);
        const mask = new_bool_2d(elem, rule_len);

        compute_bd(
            bp,
            future_ptr,
            queue,
            mask,
            MX,
            MY,
            MZ,
            C,
            rule_tbl,
            rule_len
        );
        const rootBD = bd_points(bp, state, C, elem);

        compute_fd(fp, state, queue, mask, MX, MY, MZ, C, rule_tbl, rule_len);
        const rootFD = fd_points(fp, future_ptr, C, elem);

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

        // Bottom up tree traversal
        const traverse = (board_ptr: number) => {
            const result: number[] = [];
            while (board_ptr) {
                result.push(board_ptr + board_size);
                board_ptr = board_get_parent(board_ptr);
            }
            return result;
        };

        // Map state buffer (ptr) to board (ptr)
        const visited = new HashMap<number, number>(
            (a) => a,
            null,
            (ptr1, ptr2) => eq(ptr1, ptr2, elem)
        );

        // p is priority, v is board (ptr)
        const frontier = new PriorityQueue<{ p: number; v: number }>(
            ({ p: p1 }, { p: p2 }) => p1 <= p2
        );

        const push_board = (ptr: number) =>
            frontier.enqueue({
                v: ptr,
                p: board_rank(ptr, rng.double(), dcoeff),
            });

        const root_board = new_board(elem);
        const bytes = board_size + elem;
        const aligned = bytes & 3 ? bytes + ((4 - bytes) & 3) : bytes;
        // Debug purpose
        const board_index = (ptr: number) => (ptr - root_board) / aligned;

        {
            board_init(root_board, rootBD, rootFD, 0);

            const root_state = root_board + board_size;
            lib.copy_from_external(present, root_state);

            const state_hash = hash(root_state);
            visited.set(root_state, root_board, state_hash);

            push_board(root_board);
        }

        let record = rootBD + rootFD;
        let boards = 1;

        const temp_board = { ptr: <number>bin.new_board(elem) };

        const cb = (parent_board: number) => {
            const temp_state = temp_board.ptr + board_size;

            const hash = bin.hash(temp_state, zobrist_table_ptr, elem);

            const visited_board = visited.greedy_get(hash, (k) =>
                eq(k, temp_state, elem)
            );

            if (visited_board !== null) {
                const parent_depth = board_depth(parent_board);
                const visited_board_depth = board_depth(visited_board);

                if (parent_depth + 1 < visited_board_depth) {
                    board_set_parent(visited_board, parent_board);

                    push_board(visited_board);
                }
            } else {
                const childBD = bd_points(bp, temp_state, C, elem);
                compute_fd(
                    fp,
                    temp_state,
                    queue,
                    mask,
                    MX,
                    MY,
                    MZ,
                    C,
                    rule_tbl,
                    rule_len
                );
                const childFD = fd_points(fp, future_ptr, C, elem);

                if (childBD < 0 || childFD < 0) return null;

                const child_board = temp_board.ptr;
                const child_state = child_board + board_size;

                temp_board.ptr = new_board(elem);
                boards++;

                board_init(child_board, childBD, childFD, parent_board);
                visited.set(child_state, child_board, hash);

                if (childFD === 0) {
                    const path = traverse(child_board).reverse();
                    // Reset render state
                    if (viz) Program.instance.renderer.forcedState = null;

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
                    }

                    push_board(child_board);
                }
            }

            return null;
        };

        if (all) {
            while (frontier.size > 0 && (limit < 0 || boards < limit)) {
                const parent_board = frontier.dequeue().v;

                const result = this.allChildStates(
                    parent_board,
                    amounts_ptr,
                    MX,
                    MY,
                    elem,
                    rule_ptrs,
                    temp_board,
                    cb
                );

                if (result) return result;

                if (viz && Date.now() - now > 50) {
                    Program.instance.renderer.forcedState = recordState;
                    yield visited.size;
                    now = Date.now();
                }
            }
        } else {
            while (frontier.size > 0 && (limit < 0 || boards < limit)) {
                const parent_board = frontier.dequeue().v;

                const result = this.oneChildStates(
                    parent_board,
                    MX,
                    MY,
                    elem,
                    rule_ptrs,
                    temp_board,
                    match_and_apply,
                    cb
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
        parent_board: number,
        amount_table: number,
        MX: number,
        MY: number,
        elem: number,
        rule_ptrs: number[],
        temp_board: { ptr: number },
        cb: (parent_board: number) => Uint8Array[]
    ) {
        const lib = Optimization.obs_instance;
        const bin = lib.exports;

        const board_size = bin.board_size();
        const parent_state = parent_board + board_size;
        bin.clear_amounts(amount_table, elem);

        const tiles: [number, number, number][] = [];

        for (let y = 0; y < MY; y++) {
            for (let x = 0; x < MX; x++) {
                for (let r = 0; r < rule_ptrs.length; r++) {
                    const rule = rule_ptrs[r];

                    if (
                        bin.match_rule(rule, x, y, MX, MY, elem, parent_state)
                    ) {
                        tiles.push([rule, x, y]);
                        bin.incre_rule(rule, x, y, MX, amount_table);
                    }
                }
            }
        }

        const mask = new Uint8Array(tiles.length);
        mask.fill(1);

        const solution: [number, number, number][] = [];

        const enumerate = () => {
            const I = bin.max_pos_index(amount_table, elem);

            if (I < 0) {
                const temp_state = temp_board.ptr + board_size;
                bin.copy(parent_state, temp_state, elem);
                for (const [rule_ptr, x, y] of solution) {
                    bin.apply_rule(
                        rule_ptr,
                        x,
                        y,
                        MX,
                        MY,
                        elem,
                        parent_state,
                        temp_state
                    );
                }
                return cb(parent_board);
            }

            const X = I % MX;
            const Y = ~~(I / MX);

            const cover: [number, number, number][] = [];
            for (let l = 0; l < tiles.length; l++) {
                const [rule_ptr, x, y] = tiles[l];
                if (mask[l] && bin.inside_rule(rule_ptr, X, Y, x, y))
                    cover.push([rule_ptr, x, y]);
            }

            for (const [rule1, x1, y1] of cover) {
                solution.push([rule1, x1, y1]);

                const intersecting: number[] = [];
                for (let l = 0; l < tiles.length; l++) {
                    if (!mask[l]) continue;

                    const [rule2, x2, y2] = tiles[l];
                    if (bin.rule_overlap(rule1, x1, y1, rule2, x2, y2))
                        intersecting.push(l);
                }

                for (const l of intersecting) {
                    mask[l] = 0;
                    const [rule, x, y] = tiles[l];
                    bin.decre_rule(rule, x, y, MX, amount_table);
                }

                const out = enumerate();
                if (out) return out;

                for (const l of intersecting) {
                    mask[l] = 1;
                    const [rule, x, y] = tiles[l];
                    bin.incre_rule(rule, x, y, MX, amount_table);
                }

                solution.pop();
            }

            return null;
        };

        return enumerate();
    }

    private static oneChildStates(
        parent_board: number,
        MX: number,
        MY: number,
        elem: number,
        rule_ptrs: number[],
        temp_board: { ptr: number },
        match_and_apply: Function,
        cb: (parent_board: number) => Uint8Array[]
    ) {
        for (let y = 0; y < MY; y++) {
            for (let x = 0; x < MX; x++) {
                for (let r = 0; r < rule_ptrs.length; r++) {
                    const rule_ptr = rule_ptrs[r];
                    if (
                        match_and_apply(
                            rule_ptr,
                            x,
                            y,
                            MX,
                            MY,
                            elem,
                            parent_board,
                            temp_board.ptr
                        )
                    ) {
                        const result = cb(parent_board);
                        if (result) return result;
                    }
                }
            }
        }

        return null;
    }
}

// Debug purpose
const chars = ".RW-a!?%012345";
const StateToString = (state: Uint8Array, MX: number, MY: number) => {
    const row: string[] = [];
    for (let y = 0; y < MY; y++) {
        const str: string[] = [];
        for (let x = 0; x < MX; x++) str.push(chars.charAt(state[x + y * MX]));
        row.push(str.join(""));
    }
    return row.join("\n");
};
