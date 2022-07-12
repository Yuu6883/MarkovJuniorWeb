#pragma once

#include "common.h"

typedef struct {
    uint16_t bd;
    uint16_t fd;
    uint16_t depth;
    struct board_t* parent;
} board_t;

board_t* new_board(uint32_t elem) {
    board_t* b = (board_t*) malloc(sizeof(board_t) + elem);
    return b;
}

void board_init(board_t* b, uint16_t bd, uint16_t fd, struct board_t* parent) { 
    b->bd = bd;
    b->fd = fd;
    b->parent = parent;
    b->depth = parent ? ((board_t*) parent)->depth + 1 : 0;
}

size_t board_size() {
    return sizeof(board_t);
}

double board_rank(board_t* b, double rng, double coeff) {
    double result = coeff < 0 ? (1000 - b->depth) : 
        (b->fd + b->bd + 2 * coeff * b->depth);

    return result + 0.0001 * rng;
}

uint16_t board_depth(board_t* b) {
    return b->depth;
}

void board_set_parent(board_t* b, board_t* p) {
    b->depth = p->depth + 1;
    b->parent = (struct board_t*) p;
}

struct board_t* board_get_parent(board_t* b) {
    return b->parent;
}