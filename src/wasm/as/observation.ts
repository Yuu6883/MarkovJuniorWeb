import { bool_2d_t, bool_2d_clear } from "./bool_2d";
import { potential_t, potential_fill, potential_get, potential_set } from "./potential";
import { queue_clear, queue_empty, queue_pop, queue_push, queue_t } from "./queue";

export function compute_fd_potential(
    p: potential_t,
    q: queue_t,
    mask: bool_2d_t,
    state: usize,
    MX: u32,
    MY: u32,
    MZ: u32
): void {
    potential_fill(p, -1);
    for (let i: u32 = 0; i < p.mx; i++) {
        potential_set(p, i, load<u8>(state + i), 0);
    }
    compute_potential(p, q, mask, MX, MY, MZ, false);
}

export function compute_bd_potential(
    p: potential_t,
    q: queue_t,
    mask: bool_2d_t,
    goal: usize,
    MX: u32,
    MY: u32,
    MZ: u32
): void {
    for (let c: u32 = 0; c < p.my; c++) {
        const row_ptr: usize = c * p.mx;
        for (let i: u32 = 0; i < p.mx; i++) {
            const o = i * sizeof<i32>();
            store<i32>(row_ptr + o, (load<i32>(goal + o) & (1 << c)) !== 0 ? 0 : -1);
        }
    }
    compute_potential(p, q, mask, MX, MY, MZ, true);
}

export function fd_pointwise(p: potential_t, goal: usize) : i32 {
    let sum : i32 = 0;
    for (let i: u32 = 0; i < p.mx; i++) {
        let f = load<i32>(goal + i * sizeof<i32>());
        let min = 1000,
            argmin = -1;

        for (let c: u32 = 0; c < p.my; c++, f >>= 1) {
            const potential_t = potential_get(p, i, c);
            if ((f & 1) === 1 && potential_t >= 0 && potential_t < min) {
                min = potential_t;
                argmin = c;
            }
        }

        if (argmin < 0) return -1;
        sum += min;
    }
    return sum;
}

export function bd_pointwise(p: potential_t, present: usize) : i32 {
    let sum: i32 = 0;
    for (let i: u32 = 0; i < p.mx; i++) {
        const potential_t = potential_get(p, i, load<u8>(present + i * sizeof<u8>()));
        if (potential_t < 0) return -1;
        sum += potential_t;
    }
    return sum;
}

@inline
function push_vec(q: queue_t, v: u32, x: u32, y: u32, z: u32): void {
    const item_ptr = queue_push(q);
    store<u32>(item_ptr, v, 0 * sizeof<u32>());
    store<u32>(item_ptr, x, 1 * sizeof<u32>());
    store<u32>(item_ptr, y, 2 * sizeof<u32>());
    store<u32>(item_ptr, z, 3 * sizeof<u32>());
}

@inline
function compute_potential(
    p: potential_t,
    q: queue_t,
    mask: bool_2d_t,
    MX: u32,
    MY: u32,
    MZ: u32,
    is_bd: bool) : void {

    queue_clear(q);

    for (let c: u32 = 0; c < p.my; c++) {
        const row_ptr: usize = c * p.mx;
        for (let i: u32 = 0; i < p.mx; i++) {
            if (!load<i32>(row_ptr + i * sizeof<i32>())) {
                push_vec(q, c, i % MX, (i % (MX * MY)) / MX, i / (MX * MY));
            }
        }
    }

    bool_2d_clear(mask);

    while (!queue_empty(q)) {
        const item_ptr = queue_pop(q);
        const value = load<u32>(item_ptr, 0 * sizeof<u32>());
        const x =     load<u32>(item_ptr, 1 * sizeof<u32>());
        const y =     load<u32>(item_ptr, 2 * sizeof<u32>());
        const z =     load<u32>(item_ptr, 3 * sizeof<u32>());
        const i = x + y * MX + z * MX * MY;
        const t = potential_get(p, i, value);

        /*GENERATE*/
    }
}
