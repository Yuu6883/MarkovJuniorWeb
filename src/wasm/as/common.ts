@external("env", "malloc")
export declare function malloc(size: usize): usize;
@external("env", "malloc_aligned")
export declare function malloc_aligned(size: usize, alignment: usize): usize;
