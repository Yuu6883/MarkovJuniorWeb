import Reader from "./reader";

export class VoxHelper {
    static read(buffer: ArrayBuffer): [Int32Array, number, number, number] {
        const r = new Reader(new DataView(buffer));
        let result: Int32Array = null;
        let MX = -1,
            MY = -1,
            MZ = -1;

        const magic = r.chars(4);
        const version = r.i32();

        // console.log(`${magic}version: ${version}`);

        while (!r.EOF) {
            const head = r.chars(1);

            if (head === "S") {
                const tail = r.chars(3);

                if (tail !== "IZE") continue;

                const chunkSize = r.i32();
                r.skip(4);
                MX = r.i32();
                MY = r.i32();
                MZ = r.i32();
                r.skip(chunkSize - 4 * 3);
            } else if (head === "X") {
                const tail = r.chars(3);

                if (tail !== "YZI") continue;

                if (MX <= 0 || MY <= 0 || MZ <= 0) return [null, MX, MY, MZ];
                result = new Int32Array(MX * MY * MZ);
                result.fill(-1);

                r.skip(8);
                const numVoxels = r.i32();
                for (let i = 0; i < numVoxels; i++) {
                    const x = r.u8();
                    const y = r.u8();
                    const z = r.u8();
                    const color = r.u8();
                    result[x + y * MX + z * MX * MY] = color;
                }
            }
        }

        return [result, MX, MY, MZ];
    }
}
