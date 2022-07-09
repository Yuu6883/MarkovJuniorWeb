import { malloc } from "./common";

@final
@unmanaged
class potential {
    mx: u32;
    my: u32;
}

export type potential_t = potential;

export function new_potential(mx: u32, my: u32): potential {
    if (mx <= 0 || my <= 0) abort();

    const mat: potential = changetype<potential>(
        malloc(mx * my * sizeof<i32>() + offsetof<potential>())
    );

    mat.mx = mx;
    mat.my = my;

    return mat;
}

@inline
function potential_data(mat: potential) : usize {
    return changetype<usize>(mat) + offsetof<potential>();
}

@inline
export function potential_get(mat: potential, x: u32, y: u32) : i32 {
    const offset: u32 = y * mat.mx + x;
    const ptr = potential_data(mat);
    
    return load<i32>(ptr + offset * sizeof<i32>());
}

@inline
export function potential_set(mat: potential, x: u32, y: u32, value: i32) : void {
    const offset: u32 = y * mat.mx + x;
    const ptr = potential_data(mat);

    store<i32>(ptr + offset * sizeof<i32>(), value);
}

export function potential_fill(mat: potential, value: i32) : void {
    const size: usize = mat.mx * mat.my * sizeof<i32>();
    let ptr = potential_data(mat);
    const end = ptr + size;

    while (ptr < end) {
        store<i32>(ptr, value);
        ptr += sizeof<i32>();
    }
}

export function potential_clear(mat: potential) : void {
    const size: usize = mat.mx * mat.my * sizeof<i32>();
    memory.fill(potential_data(mat), 0x0, size);
}

export function potential_x(mat: potential) : u32 {
    return mat.mx;
}

export function potential_y(mat: potential) : u32 {
    return mat.my;
}