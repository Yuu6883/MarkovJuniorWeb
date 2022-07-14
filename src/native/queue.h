#pragma once

#include "common.h"

typedef struct {
    uint32_t start;
    uint32_t len;
    uint32_t capacity;
    uint32_t elem;
} queue_t;

queue_t* new_queue(uint32_t elem, uint32_t capacity) {
    if (elem <= 0 || capacity <= 0) abort();

    queue_t* queue = (queue_t*) malloc(sizeof(queue_t) + capacity * elem);
    
    queue->start = 0;
    queue->len = 0;
    queue->elem = elem;
    queue->capacity = capacity;

    return queue;
}

bool queue_full(queue_t* queue) {
    return queue->len >= queue->capacity;
}

inline bool queue_empty(queue_t* queue) {
    return queue->len == 0;
}

inline void* queue_data(queue_t* queue) {
    return (uint8_t*) queue + sizeof(queue_t);
}

inline void* queue_push(queue_t* queue) {
    if (queue_full(queue)) {
        queue_overflow(queue->len, queue->capacity);
        abort();
    }

    void* data = queue_data(queue);
    void* ptr = (uint8_t*) data + queue->elem * ((queue->start + queue->len) % queue->capacity);

    queue->len++;

    return ptr;
}

inline void* queue_pop(queue_t* queue) {
    if (queue_empty(queue)) abort();

    void* data = queue_data(queue);
    void* ptr = (uint8_t*) data + queue->elem * queue->start;

    queue->start = (queue->start + 1) % queue->capacity;
    queue->len--;

    return ptr;
}

inline void queue_clear(queue_t* queue) {
    queue->start = 0;
    queue->len = 0;
}