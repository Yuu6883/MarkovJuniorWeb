import { malloc } from "./common";

@final
@unmanaged
class bool_2d {
    mx: u32;
    my: u32;
}

export function new_bool_2d(mx: u32, my: u32): bool_2d {
    if (mx <= 0 || my <= 0) abort();

    const total: usize = mx * my;
    const size: usize = (total & 7 ? 1 : 0) + (total >>> 3);

    const mat: bool_2d = changetype<bool_2d>(
        malloc(size + offsetof<bool_2d>())
    );

    mat.mx = mx;
    mat.my = my;

    return mat;
}

@inline
function bool_2d_data(mat: bool_2d) : usize {
    return changetype<usize>(mat) + offsetof<bool_2d>();
}

export function bool_2d_get(mat: bool_2d, x: u32, y: u32) : bool {
    const offset: u32 = y * mat.mx + x;
    const mask: u8 = 1 << u8(offset % 8);
    const data = bool_2d_data(mat);
    
    return bool(load<u8>(data + (offset >>> 3)) & mask);
}

export function bool_2d_set(mat: bool_2d, x: u32, y: u32, value: bool) : void {
    const offset: u32 = y * mat.mx + x;
    const mask: u8 = 1 << u8(offset % 8);
    const data = bool_2d_data(mat);
    const ptr = data + (offset >>> 3);

    const pre = load<u8>(ptr);
    store<u8>(ptr, value ? (pre | mask) : (pre & (0xFF ^ mask)));
}

export function bool_2d_fill(mat: bool_2d) : void {
    const total: usize = mat.mx * mat.my;
    const size: usize = (total & 7 ? 1 : 0) + (total >>> 3);
    memory.fill(bool_2d_data(mat), 0xFF, size);
}

export function bool_2d_clear(mat: bool_2d) : void {
    const total: usize = mat.mx * mat.my;
    const size: usize = (total & 7 ? 1 : 0) + (total >>> 3);
    memory.fill(bool_2d_data(mat), 0x0, size);
}

export function bool_2d_x(mat: bool_2d) : u32 {
    return mat.mx;
}

export function bool_2d_y(mat: bool_2d) : u32 {
    return mat.my;
}