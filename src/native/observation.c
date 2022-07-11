#include "rule.h"
#include "queue.h"
#include "bool_2d.h"
#include "pool.h"

size_t ptr_size() { return sizeof(void*); }

inline void push(queue_t* queue, uint16_t c, uint16_t x, uint16_t y, uint16_t z) {
    uint16_t* item = (uint16_t*) queue_push(queue);
    item[0] = c;
    item[1] = x;
    item[2] = y;
    item[3] = z;    
}

bool match(rule_t* rule, int32_t x, int32_t y, int32_t z,
    int32_t* potentials, int32_t t, 
    uint16_t MX, uint16_t MY, 
    uint32_t elem, bool bd) {
    
    uint16_t dz = 0, dy = 0, dx = 0;
    uint8_t* a = bd ? rule->output : rule->binput;
    uint32_t len = bd ? rule->o_len : rule->i_len;

    for (uint32_t di = 0; di < len; di++) {
        uint8_t value = a[di];

        if (value != 0xff) {
            int32_t current = potentials[value * elem + x + dx + (y + dy) * MX + (z + dz) * MX * MY];
            if (current > t || current == -1) return false;
        }
        dx++;

        if (dx == rule->imx) {
            dx = 0; 
            dy++;

            if (dy == rule->imy) { 
                dy = 0;
                dz++; 
            }
        }
    }

    return true;
}

void apply(rule_t* rule, int32_t x, int32_t y, int32_t z, 
    int32_t* potential, int32_t t, 
    uint16_t MX, uint16_t MY, 
    uint32_t elem, queue_t* queue, bool bd) {

    uint8_t* a = bd ? rule->binput : rule->output;
    for (int32_t dz = 0; dz < rule->imz; dz++) {
        int32_t zdz = z + dz;
        for (int32_t dy = 0; dy < rule->imy; dy++) {
            int32_t ydy = y + dy;
            for (int32_t dx = 0; dx < rule->imx; dx++) {
                int32_t xdx = x + dx;
                int32_t idi = xdx + ydy * MX + zdz * MX * MY;
                int32_t di = dx + dy * rule->imx + dz * rule->imx * rule->imy;
                uint8_t o = a[di];

                if (o != 0xff && potential[o * elem + idi] == -1) {
                    potential[o * elem + idi] = t + 1;
                    push(queue, o, xdx, ydy, zdz);
                }
            }
        }
    }
}

void compute_fd(int32_t* potential, uint8_t* state, 
    queue_t* queue, bool_2d* mask,
    uint16_t MX, uint16_t MY, uint16_t MZ, uint16_t C, 
    rule_t** rules, uint16_t rule_len) {

    queue_clear(queue);

    size_t elem = MX * MY * MZ;
    for (uint16_t i = 0; i < elem * C; i++) potential[i] = -1;
    for (uint16_t i = 0; i < elem; i++) {
        uint8_t c = state[i];
        potential[c * elem + i] = 0;
        push(queue, c, i % MX, (i % (MX * MY)) / MX, i / (MX * MY));
    }

    bool_2d_clear(mask);

    while (!queue_empty(queue)) {
        uint16_t* item = (uint16_t*) queue_pop(queue);

        uint16_t value = item[0];
        uint16_t x = item[1];
        uint16_t y = item[2];
        uint16_t z = item[3];

        uint32_t i = x + y * MX + z * MX * MY;
        int32_t t = potential[i + value * elem];

        for (uint16_t r = 0; r < rule_len; r++) {
            rule_t* rule = rules[r];

            iter_rule_ishift(rule, value, {
                int32_t sx = x - shift.x;
                int32_t sy = y - shift.y;
                int32_t sz = z - shift.z;

                if (sx < 0 || sy < 0 || sz < 0 ||
                    sx + rule->imx > MX ||
                    sy + rule->imy > MY ||
                    sz + rule->imz > MZ) continue;

                uint32_t si = sx + sy * MX + sz * MX * MY;
                if (!bool_2d_get(mask, si, r) && match(rule, sx, sy, sz, potential, t, MX, MY, elem, false)) {
                    bool_2d_set(mask, si, r, true);
                    apply(rule, sx, sy, sz, potential, t, MX, MY, elem, queue, false);
                }
            });
        }
    }
}

void compute_bd(int32_t* potential, int32_t* future, 
    queue_t* queue, bool_2d* mask,
    uint16_t MX, uint16_t MY, uint16_t MZ, uint16_t C, 
    rule_t** rules, uint16_t rule_len) {

    queue_clear(queue);
    
    size_t elem = MX * MY * MZ;

    for (uint16_t c = 0; c < C; c++) {
        int32_t* row = potential + elem * c;
        for (uint16_t i = 0; i < elem; i++) {
            int32_t m = future[i] & (1 << c);
            row[i] = m != 0 ? 0 : -1;
            if (m) push(queue, c, i % MX, (i % (MX * MY)) / MX, i / (MX * MY));
        }
    }

    bool_2d_clear(mask);

    // for (uint16_t r = 0; r < rule_len; r++) {
    //     rule_t* rule = rules[r];

    //     for (uint16_t c = 0; c < C; c++) {

    //     }
    // }

    while (queue->len > 0) {
        uint16_t* item = (uint16_t*) queue_pop(queue);

        uint16_t value = item[0];
        uint16_t x = item[1];
        uint16_t y = item[2];
        uint16_t z = item[3];

        uint32_t i = x + y * MX + z * MX * MY;
        int32_t t = potential[i + value * elem];

        for (uint16_t r = 0; r < rule_len; r++) {
            rule_t* rule = rules[r];

            iter_rule_oshift(rule, value, {
                int32_t sx = x - shift.x;
                int32_t sy = y - shift.y;
                int32_t sz = z - shift.z;

                if (sx < 0 || sy < 0 || sz < 0 ||
                    sx + rule->imx > MX ||
                    sy + rule->imy > MY ||
                    sz + rule->imz > MZ) continue;

                uint32_t si = sx + sy * MX + sz * MX * MY;
                if (!bool_2d_get(mask, si, r) && 
                    match(rule, sx, sy, sz, potential, t, MX, MY, elem, true)) {

                    bool_2d_set(mask, si, r, true);
                    apply(rule, sx, sy, sz, potential, t, MX, MY, elem, queue, true);
                }
            });
        }
    }
}

int32_t fd_points(int32_t* potentials, int32_t* future, uint16_t C, uint32_t elem) {
    int32_t sum = 0;

    for (uint32_t i = 0; i < elem; i++) {
        int32_t f = future[i];
        int32_t min = 1000;
        int32_t argmin = -1;
        
        for (uint16_t c = 0; c < C; c++, f >>= 1) {
            int32_t p = potentials[c * elem + i];
            if ((f & 1) == 1 && p >= 0 && p < min) {
                min = p;
                argmin = c;
            }
        }

        if (argmin < 0) return -1;
        sum += min;
    }

    return sum;
}

int32_t bd_points(int32_t* potentials, uint8_t* present, uint16_t C, uint32_t elem) {
    int32_t sum = 0;

    for (uint32_t i = 0; i < elem; i++) {
        int32_t p = potentials[present[i] * elem + i];
        if (p < 0) return -1;
        sum += p;
    }

    return sum;
}

bool match_rule(rule_t* rule, uint16_t x, uint16_t y, 
    uint16_t MX, uint16_t MY, uint32_t elem, uint8_t* state) {
    if (x + rule->imx > MX || y + rule->imx > MY) return false;

    uint16_t dy = 0, dx = 0;
    for (uint16_t di = 0; di < rule->i_len; di++) {
        if ((rule->input[di] & (1 << state[x + dx + (y + dy) * MX])) == 0)
            return false;

        dx++;
        if (dx == rule->imx) {
            dx = 0;
            dy++;
        }
    }
    
    return true;
}

void apply_rule(rule_t* rule, uint16_t x, uint16_t y, uint16_t MX, 
    uint8_t* state, uint8_t* new_state, uint32_t elem) {

    memcpy(new_state, state, elem);
    
    for (uint16_t dz = 0; dz < rule->omz; dz++)
        for (uint16_t dy = 0; dy < rule->omy; dy++)
            for (uint16_t dx = 0; dx < rule->omx; dx++) {
                uint8_t newValue =
                    rule->output[dx + dy * rule->omx + dz * rule->omx * rule->omy];
                if (newValue != 0xff) new_state[x + dx + (y + dy) * MX] = newValue;
            }
}