export class BoolArray2DRow {
    private readonly ref: BoolArray2D;
    private readonly y: number;
    constructor(ref: BoolArray2D, y: number) {
        this.ref = ref;
        this.y = y;
    }

    get(x: number) {
        return this.ref.get(x, this.y);
    }

    set(x: number, value: boolean) {
        this.ref.set(x, this.y, value);
    }
}

// when will google add a BitSet class sigh
export class BoolArray2D {
    private buf: Uint8Array;

    public readonly MX: number;
    public readonly MY: number;

    constructor(x: number, y: number) {
        this.MX = x;
        this.MY = y;
        this.buf = new Uint8Array(Math.ceil((x * y) / 8));
    }

    get(x: number, y: number) {
        const offset = y * this.MX + x;
        return ((this.buf[~~(offset / 8)] >>> offset % 8) & 1) === 1;
    }

    set(x: number, y: number, value: boolean) {
        const offset = y * this.MX + x;
        const mask = 1 << offset % 8;
        value
            ? (this.buf[~~(offset / 8)] |= mask) // set bit
            : (this.buf[~~(offset / 8)] &= 0xff ^ mask); // clear bit
    }

    row(y: number) {
        return new BoolArray2DRow(this, y);
    }

    fill() {
        this.buf.fill(0xff);
    }

    clear() {
        this.buf.fill(0);
    }
}

export class Array2D<T extends ArrayBufferView> {
    public readonly arr: T;
    public readonly MX: number;
    public readonly MY: number;

    constructor(
        ctor: (len: number) => T,
        MX: number,
        MY: number,
        func?: (x: number, y: number) => number
    ) {
        this.arr = ctor(MX * MY);
        if (func) {
            for (let y = 0; y < MY; y++) {
                for (let x = 0; x < MX; x++) {
                    this.arr[y * MX + x] = func(x, y);
                }
            }
        }
        this.MX = MX;
        this.MY = MY;
    }

    get(x: number, y: number) {
        return this.arr[y * this.MX + x];
    }

    set(x: number, y: number, value: number) {
        this.arr[y * this.MX + x] = value;
    }
}

export class Array3D<T extends ArrayBufferView> {
    public readonly arr: T;
    public readonly MX: number;
    public readonly MY: number;
    public readonly MZ: number;

    constructor(
        ctor: (len: number) => T,
        MX: number,
        MY: number,
        MZ: number,
        func?: (x: number, y: number, z: number) => number
    ) {
        this.arr = ctor(MX * MY * MZ);
        if (func) {
            for (let z = 0; z < MZ; z++) {
                for (let y = 0; y < MY; y++) {
                    for (let x = 0; x < MX; x++) {
                        this.arr[z * MX * MY + y * MX + x] = func(x, y, z);
                    }
                }
            }
        }
        this.MX = MX;
        this.MY = MY;
        this.MZ = MZ;
    }

    get(x: number, y: number, z: number) {
        return this.arr[z * this.MX * this.MY + y * this.MX + x];
    }

    set(x: number, y: number, z: number, value: number) {
        this.arr[z * this.MX * this.MY + y * this.MX + x] = value;
    }
}

export class AH {
    // Typescript is stupid
    public static array3Dflat<T extends ArrayBufferView>(
        ctor: (len: number) => T,
        MX: number,
        MY: number,
        MZ: number,
        func: (x: number, y: number, z: number) => number
    ) {
        const arr = ctor(MX * MY * MZ);
        for (let z = 0; z < MZ; z++) {
            for (let y = 0; y < MY; y++) {
                for (let x = 0; x < MX; x++) {
                    arr[z * MX * MY + y * MX + x] = func(x, y, z);
                }
            }
        }
        return arr;
    }
}
