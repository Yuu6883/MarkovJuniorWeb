import { TypedArray, TypedArrayConstructor } from "../helpers/datastructures";

export class WasmInstance {
    private instance: WebAssembly.Instance;
    private memory: WebAssembly.Memory;
    private ptr = 0;
    public view: DataView;

    get memory_size() {
        return this.memory.buffer.byteLength;
    }

    get exports() {
        return this.instance.exports as any;
    }

    async load(module: WebAssembly.Module, memory: WebAssembly.Memory) {
        const env:
            | { [key: string]: Function }
            | { memory: WebAssembly.Memory } = {
            memory,
        };

        const start = performance.now();

        const info_list = WebAssembly.Module.imports(module);
        for (const info of info_list) {
            if (!(info.name in env)) {
                env[info.name] = this[info.name]
                    ? this[info.name].bind(this)
                    : function () {
                          console.log(
                              `${info.name}: ${[...arguments].join(",")}`
                          );
                      };
            }
        }

        this.instance = await WebAssembly.instantiate(module, {
            env,
        });
        this.memory = memory;
        this.view = new DataView(this.memory.buffer);

        const end = performance.now();
        console.log(`WebAssembly init took ${(end - start).toFixed(2)}ms`);
    }

    private abort() {
        throw new Error("abort");
    }

    get malloc_aligned() {
        return this.malloc;
    }

    public malloc(size: number, alignment = 4) {
        if (size <= 0) return null;

        while (this.ptr % alignment) this.ptr++;

        const old_ptr = this.ptr;
        this.ptr += size;
        const delta = this.ptr - this.memory.buffer.byteLength;

        if (delta >= 0) {
            const grow_min = 16; // grow 1 MB at least
            this.memory.grow(Math.max(grow_min, 1 + (delta >>> 16)));
            this.view = new DataView(this.memory.buffer);
        }

        // console.log(
        //     `malloc'd ${size} bytes (alignment = ${alignment}), ptr = ${old_ptr}, mem.size = ${this.memory_size}`
        // );
        return old_ptr;
    }

    public typed_array<T>(
        type: TypedArrayConstructor<T>,
        ptr: number,
        len: number
    ) {
        return new type(this.memory.buffer, ptr, len);
    }

    copy_to_external<T extends TypedArray>(
        ptr: number,
        dist: T,
        len = dist.length
    ) {
        dist.set(
            new (dist.constructor as TypedArrayConstructor<T>)(
                this.memory.buffer,
                ptr,
                len
            )
        );
        return dist;
    }

    copy_from_external(src: TypedArray, ptr: number, len = src.length) {
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
}

export class WasmModule {
    private readonly module: WebAssembly.Module;

    constructor(module: WebAssembly.Module) {
        this.module = module;
    }

    async init(initial = 16) {
        const memory = new WebAssembly.Memory({ initial });
        const wi = new WasmInstance();
        await wi.load(this.module, memory);
        return wi;
    }

    static async load(buffer: ArrayBuffer) {
        const module = await WebAssembly.compile(buffer);
        return new WasmModule(module);
    }
}
