import { malloc } from "./common";

@final
@unmanaged
class queue {
    start: u32;
    len: u32;
    capacity: u32;
    elem: u32;
}

export type queue_t = queue;

export function new_queue(bytes_per_elem: u32, capacity: u32): queue {
    if (bytes_per_elem <= 0 || capacity <= 0) abort();

    const ptr = malloc(offsetof<queue>() + capacity * bytes_per_elem);
    const q = changetype<queue>(ptr);

    q.start = 0;
    q.len = 0;
    q.elem = bytes_per_elem;
    q.capacity = capacity;

    return q;
}

export function queue_clear(q: queue): void {
    q.start = 0;
    q.len = 0;
}

export function queue_full(q: queue): bool {
    return q.len >= q.capacity;
}

export function queue_empty(q: queue): bool {
    return q.len == 0;
}

export function queue_len(q: queue): u32 {
    return q.len;
}

export function queue_elem(q: queue): u32 {
    return q.elem;
}

export function queue_capacity(q: queue): u32 {
    return q.capacity;
}

// @ts-expect-error
@inline
function queue_data(q: queue): usize {
    return changetype<usize>(q) + offsetof<queue>();
}

export function queue_push(q: queue): usize {
    if (queue_full(q)) abort();

    const data = queue_data(q);
    const ptr: usize = data + q.elem * ((q.start + q.len) % q.capacity);

    q.len++;

    return ptr;
}

export function queue_pop(q: queue): usize {
    if (queue_empty(q)) abort();

    const data = queue_data(q);
    const ptr = data + q.elem * q.start;
    
    q.start = (q.start + 1) % q.capacity;
    q.len--;

    return ptr;
}