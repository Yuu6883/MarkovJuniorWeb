import { malloc } from "./common";

@final
@unmanaged
class queue_t {
    start: u32;
    len: u32;
    capacity: u32;
    elem: u32;
}

export function new_queue(elem: u32, capacity: u32): queue_t {
    if (elem <= 0 || capacity <= 0) abort();

    const ptr = malloc(offsetof<queue_t>() + capacity * elem);
    const queue = changetype<queue_t>(ptr);

    queue.start = 0;
    queue.len = 0;
    queue.elem = elem;
    queue.capacity = capacity;

    return queue;
}

export function queue_full(queue: queue_t): bool {
    return queue.len >= queue.capacity;
}

export function queue_empty(queue: queue_t): bool {
    return queue.len == 0;
}

export function queue_len(queue: queue_t): u32 {
    return queue.len;
}

export function queue_elem(queue: queue_t): u32 {
    return queue.elem;
}

export function queue_capacity(queue: queue_t): u32 {
    return queue.capacity;
}

@inline
function queue_data(queue: queue_t): usize {
    return changetype<usize>(queue) + offsetof<queue_t>();
}

export function queue_push(queue: queue_t): usize {
    if (queue_full(queue)) abort();

    const data = queue_data(queue);
    const ptr = data + queue.elem * ((queue.start + queue.len) % queue.capacity);

    queue.len++;

    return ptr;
}

export function queue_pop(queue: queue_t): usize {
    if (queue_empty(queue)) abort();

    const data = queue_data(queue);
    const ptr = data + queue.elem * queue.start;
    
    queue.start = (queue.start + 1) % queue.capacity;
    queue.len--;

    return ptr;
}