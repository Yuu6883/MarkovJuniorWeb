#include "common.h"

typedef struct {
    int16_t x;
    int16_t y;
    int16_t z;
} i16_vec3_t;

typedef struct {
    uint16_t imx;
    uint16_t imy;
    uint16_t imz;
    
    uint16_t omx;
    uint16_t omy;
    uint16_t omz;

    uint16_t c;

    uint32_t i_len;
    uint32_t o_len;

    uint8_t* binput;
    int32_t* input;
    uint8_t* output;

    uint16_t* ishift_offset_table;
    uint16_t* oshift_offset_table;

    i16_vec3_t* ishifts;
    i16_vec3_t* oshifts;
} rule_t;

rule_t* new_rule(uint16_t imx, uint16_t imy, uint16_t imz, 
    uint16_t omx, uint16_t omy, uint16_t omz, 
    uint16_t c, uint16_t i_shifts, uint16_t o_shifts) {

    if (imx <= 0 || imy <= 0 || imz <= 0 ||
        omx <= 0 || omy <= 0 || omz <= 0) abort();

    rule_t* rule = (rule_t*) malloc(sizeof(rule_t));

    rule->imx = imx;
    rule->imy = imy;
    rule->imz = imz;
    rule->i_len = imx * imy * imz;

    rule->omx = omx;
    rule->omy = omy;
    rule->omz = omz;
    rule->o_len = omx * omy * omz;

    rule->c = c;
    
    rule->binput = (uint8_t*) malloc(rule->i_len * sizeof(uint8_t));
    rule->output = (uint8_t*) malloc(rule->o_len * sizeof(uint8_t));

    rule->input = (int32_t*) malloc(rule->i_len * sizeof(int32_t));

    rule->ishift_offset_table = (uint16_t*) malloc((c + 1) * sizeof(uint16_t));
    rule->oshift_offset_table = (uint16_t*) malloc((c + 1) * sizeof(uint16_t));
    
    // Last one set to length of the shifts
    rule->ishift_offset_table[c] = i_shifts;
    rule->oshift_offset_table[c] = o_shifts;

    rule->ishifts = (i16_vec3_t*) malloc(i_shifts * sizeof(i16_vec3_t));
    rule->oshifts = (i16_vec3_t*) malloc(o_shifts * sizeof(i16_vec3_t));

    return rule;
}

uint8_t* rule_binput(rule_t* rule) {
    return rule->binput;
}

uint8_t* rule_output(rule_t* rule) {
    return rule->output;
}

int32_t* rule_input(rule_t* rule) {
    return rule->input;
}

uint16_t* rule_ishift_offset(rule_t* rule) {
    return rule->ishift_offset_table;
}

uint16_t* rule_oshift_offset(rule_t* rule) {
    return rule->oshift_offset_table;
}

i16_vec3_t* rule_ishift_array(rule_t* rule) {
    return rule->ishifts;
}

i16_vec3_t* rule_oshift_array(rule_t* rule) {
    return rule->oshifts;
}

size_t shift_size() {
    return sizeof(i16_vec3_t);
}

#define iter_rule_ishift(rule, value, code) { \
    uint16_t __offset = rule->ishift_offset_table[value]; \
    uint16_t __end = rule->ishift_offset_table[value + 1]; \
    while (__offset < __end) { \
        i16_vec3_t shift = rule->ishifts[__offset++]; \
        code \
    } \
}

#define iter_rule_oshift(rule, value, code) { \
    uint16_t __offset = rule->oshift_offset_table[value]; \
    uint16_t __end = rule->oshift_offset_table[value + 1]; \
    while (__offset < __end) { \
        i16_vec3_t shift = rule->oshifts[__offset++]; \
        code \
    } \
}

void log_rule_ishift(rule_t* rule) {
    for (uint16_t v = 0; v < rule->c; v++) {
        iter_rule_ishift(rule, v, {
            log_shift(v, shift.x, shift.y, shift.z);
        });
    }
}

void log_rule_oshift(rule_t* rule) {
    for (uint16_t v = 0; v < rule->c; v++) {
        iter_rule_oshift(rule, v, {
            log_shift(v, shift.x, shift.y, shift.z);
        });
    }
}