export class AH {
    // Typescript is stupid
    public static array3Dflat<T>(
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
