#pragma once

#include "common.h"

typedef struct {
    uint32_t mx;
    uint32_t my;
} bool_2d;

bool_2d* new_bool_2d(uint32_t mx, uint32_t my) {
    if (mx <= 0 || my <= 0) abort();

    size_t total = mx * my;
    size_t size = ((total & 7) ? 1 : 0) + (total >> 3);

    bool_2d* mat = (bool_2d*) malloc(size + sizeof(bool_2d));
    
    mat->mx = mx;
    mat->my = my;
    
    return mat;
}

inline uint8_t* bool_2d_data(bool_2d* mat) {
    return (uint8_t*) mat + sizeof(bool_2d);
}

bool bool_2d_get(bool_2d* mat, uint32_t x, uint32_t y) {
    uint32_t offset = y * mat->mx + x;
    uint8_t mask = 1 << (offset % 8);
    uint8_t* data = bool_2d_data(mat);
    return data[offset >> 3] & mask;
}

void bool_2d_set(bool_2d* mat, uint32_t x, uint32_t y, bool value) {
    uint32_t offset = y * mat->mx + x;
    uint8_t mask = 1 << (offset % 8);
    uint8_t* data = bool_2d_data(mat);
    value ? (data[offset >> 3] |= mask) : (data[offset >> 3] &= (0xFF ^ mask));
}

void bool_2d_fill(bool_2d* mat) {
    size_t total = mat->mx * mat->my;
    size_t size = ((total & 7) ? 1 : 0) + (total >> 3);
    memset(bool_2d_data(mat), 0xFF, size);
}

void bool_2d_clear(bool_2d* mat) {
    size_t total = mat->mx * mat->my;
    size_t size = ((total & 7) ? 1 : 0) + (total >> 3);
    memset(bool_2d_data(mat), 0x0, size);
}

uint32_t bool_2d_x(bool_2d* mat) {
    return mat->mx;
}

uint32_t bool_2d_y(bool_2d* mat) {
    return mat->my;
}