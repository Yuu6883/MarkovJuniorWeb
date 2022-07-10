import { TypedArray, TypedArrayConstructor } from "../helpers/datastructures";
import { Log } from "../helpers/log";

export class WasmInstance {
    private instance: WebAssembly.Instance;
    private memory: WebAssembly.Memory;
    private ptr = 0;
    private L = new Log();

    get memory_size() {
        return this.memory.buffer.byteLength;
    }

    get exports() {
        return this.instance.exports as any;
    }

    async load(module: WebAssembly.Module, memory: WebAssembly.Memory) {
        this.instance = await WebAssembly.instantiate(module, {
            env: {
                memory,
                abort: () => {
                    throw Error("abort");
                },
                malloc: this.malloc.bind(this),
                malloc_aligned: this.malloc.bind(this),
                log_u32: console.log,
                log_push: (v, x, y, z) =>
                    console.log(`push: [${v},${x},${y},${z}]`),
                log_set_2d: (x, y, v) => console.log(`[${x},${y}] = ${v}`),
                log_rule_match: (r, x, y, z) =>
                    this.L.log(`Rule[${r}] match: [${x},${y},${z}]`),
            },
        });
        this.memory = memory;
    }

    public malloc(size: number, alignment = 4) {
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

    public u8_view(ptr: number, len: number) {
        return new Uint8Array(this.memory.buffer, ptr, len);
    }

    copy_to_external(ptr: number, dist: TypedArray, len = dist.byteLength) {
        dist.set(
            new (dist.constructor as TypedArrayConstructor<TypedArray>)(
                this.memory.buffer,
                ptr,
                len
            )
        );
    }

    copy_from_external(src: TypedArray, ptr: number, len = src.byteLength) {
        new (src.constructor as TypedArrayConstructor<TypedArray>)(
            this.memory.buffer,
            ptr,
            len
        ).set(src);
    }

    reset() {
        this.ptr = 0;
        new Uint8Array(this.memory.buffer).fill(0);
    }

    save_log(name: string) {
        this.L.save(name);
    }
}

export class WasmModule {
    private readonly module: WebAssembly.Module;

    constructor(module: WebAssembly.Module) {
        this.module = module;
    }

    async init(initial = 1024) {
        const memory = new WebAssembly.Memory({ initial }); // 64MB
        const wi = new WasmInstance();
        await wi.load(this.module, memory);
        return wi;
    }

    static async load(buffer: ArrayBuffer) {
        const module = await WebAssembly.compile(buffer);
        return new WasmModule(module);
    }
}
