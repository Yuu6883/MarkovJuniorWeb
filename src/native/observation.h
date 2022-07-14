#pragma once

#include "common.h"

typedef struct {
    uint8_t valid;
    uint8_t from;
    int32_t to;
} obs_t;

size_t obs_size() {
    return sizeof(obs_t);
}

void obs_init(obs_t* obs, uint8_t valid, uint8_t from, int32_t to) {
    obs->valid = valid;
    obs->from = from;
    obs->to = to;
}