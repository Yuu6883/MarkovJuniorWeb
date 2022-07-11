#pragma once

#include "common.h"

bool eq(uint8_t* a, uint8_t* b, uint32_t size) {
    for (uint32_t i = 0; i < size; i++) if (a[i] != b[i]) return false;
    return true;
}

int32_t hash(uint8_t* a, int32_t* table, uint32_t size) {
    int32_t h = 0;
    for (uint32_t i = 0; i < size; i++) {
        h ^= table[a[i] * size + i];
    }
    return h;
}