const fs = require("fs");

class Allocator {
    /** @param {WebAssembly.Memory} memory */
    constructor(memory) {
        this.memory = memory;
        this.ptr = 0;
    }

    malloc(size, alignment = 4) {
        if (size <= 0) return null;

        while (this.ptr % alignment) this.ptr++;

        const old_ptr = this.ptr;
        this.ptr += size;
        const delta = this.ptr - this.memory.buffer.byteLength;
        if (delta >= 0) this.memory.grow(1 + (delta >>> 16));

        console.log(
            `malloc'd ${size} bytes (alignment = ${alignment}), ptr = ${old_ptr}`
        );
        return old_ptr;
    }

    copy_to_external(ptr, dist, len = dist.byteLength) {
        dist.set(new dist.constructor(this.memory.buffer, ptr, len));
    }

    copy_from_external(src, ptr, len = src.byteLength) {
        new src.constructor(this.memory.buffer, ptr, len).set(src);
    }
}

module.exports = async (file, initial = 2) => {
    const bin = fs.readFileSync(`../bin/${file}`);

    const memory = new WebAssembly.Memory({ initial });
    const alloc = new Allocator(memory);

    const wm = await WebAssembly.compile(bin);
    const instance = await WebAssembly.instantiate(wm, {
        env: {
            memory,
            abort: () => {
                throw Error("abort");
            },
            malloc: alloc.malloc.bind(alloc),
            malloc_aligned: alloc.malloc.bind(alloc),
        },
    });

    return { exports: instance.exports, alloc };
};
