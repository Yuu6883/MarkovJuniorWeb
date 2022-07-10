// @ts-expect-error
@external("env", "malloc")
export declare function malloc(size: usize): usize;
// @ts-expect-error
@external("env", "malloc_aligned")
export declare function malloc_aligned(size: usize, alignment: usize): usize;
// @ts-expect-error
@external("env", "log_u32")
export declare function log_u32(n: u32): void;
// @ts-expect-error
@external("env", "log_push")
export declare function log_push(v: u32, x: u32, y: u32, z: u32): void;
// @ts-expect-error
@external("env", "log_set_2d")
export declare function log_set_2d(x: u32, y: u32, v: i32): void;
// @ts-expect-error
@external("env", "log_rule_match")
export declare function log_rule_match(r: i32, x: i32, y: i32, z: i32): void;