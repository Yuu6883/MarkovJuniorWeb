import { TypedArray, TypedArrayConstructor } from "../helpers/datastructures";

export class WasmInstance {
    private readonly instance: WebAssembly.Instance;
    private readonly memory: WebAssembly.Memory;
    private ptr = 0;

    constructor(instance: WebAssembly.Instance, memory: WebAssembly.Memory) {
        this.instance = instance;
        this.memory = memory;
    }

    get memory_size() {
        return this.memory.buffer.byteLength;
    }

    malloc(size: number, alignment = 4) {
        if (size <= 0) return null;

        while (this.ptr % alignment) this.ptr++;

        const old_ptr = this.ptr;
        this.ptr += size;
        const delta = this.ptr - this.memory.buffer.byteLength;
        if (delta >= 0) this.memory.grow(1 + (delta >>> 16));
        return old_ptr;
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

    memset(ptr: number, value: number, len: number) {
        // TODO:
    }
}

export class WasmModule {
    private readonly module: WebAssembly.Module;

    constructor(module: WebAssembly.Module) {
        this.module = module;
    }

    async init(imports: WebAssembly.Imports, initial = 1024) {
        const memory = new WebAssembly.Memory({ initial }); // 64MB
        return new WasmInstance(
            await WebAssembly.instantiate(this.module, imports),
            memory
        );
    }

    static test() {
        return new WasmInstance(null, new WebAssembly.Memory({ initial: 1 }));
    }

    static async load(buffer: ArrayBuffer) {
        const module = await WebAssembly.compile(buffer);
        return new WasmModule(module);
    }
}
