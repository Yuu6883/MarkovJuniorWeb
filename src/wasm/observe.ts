import { WasmInstance } from ".";
import { Grid } from "../grid";
import { RuleNode } from "../mj-nodes";
import { Optimization } from "./optimization";

export class NativeObserve {
    private readonly lib: WasmInstance;

    private readonly state_len: number;
    private readonly C: number;

    private readonly potential_ptr: number;
    private readonly future_ptr: number;
    private readonly state_ptr: number;
    private readonly rule_ptrs: number[];
    private readonly rule_tbl: number;
    private readonly obs_ptr: number;
    private readonly mask_ptr1: number;
    private readonly mask_ptr2: number;
    private readonly queue_ptr: number;

    constructor(lib: WasmInstance, grid: Grid, node: RuleNode) {
        this.lib = lib;

        this.state_len = grid.state.length;
        this.C = grid.C;

        this.potential_ptr = lib.malloc(
            this.state_len * this.C * Int32Array.BYTES_PER_ELEMENT
        );

        this.future_ptr = lib.malloc(
            this.state_len * Int32Array.BYTES_PER_ELEMENT
        );

        this.state_ptr = lib.malloc(
            this.state_len * Uint8Array.BYTES_PER_ELEMENT
        );

        const bin = lib.exports;
        const ptr_size = <number>bin.ptr_size();

        this.rule_ptrs = node.rules.map((r) => Optimization.load_rule(lib, r));
        this.rule_tbl = lib.malloc(this.rule_ptrs.length * ptr_size);

        // wasm32
        if (ptr_size === 4) {
            for (let i = 0; i < this.rule_ptrs.length; i++) {
                lib.view.setUint32(
                    this.rule_tbl + i * 4,
                    this.rule_ptrs[i],
                    true
                );
            }
            // wasm64
        } else if (ptr_size === 8) {
            for (let i = 0; i < this.rule_ptrs.length; i++) {
                lib.view.setBigUint64(
                    this.rule_tbl + i * 8,
                    BigInt(this.rule_ptrs[i]),
                    true
                );
            }
        } else throw Error(`ptr_size = ${ptr_size}?????`);

        const obs_size = <number>bin.obs_size();
        this.obs_ptr = lib.malloc(obs_size * this.C);

        for (let i = 0; i < node.observations.length; i++) {
            const obs = node.observations[i];
            const ptr = this.obs_ptr + i * obs_size;

            if (obs) {
                bin.obs_init(ptr, 1, obs.from, obs.to);
            } else {
                bin.obs_init(ptr, 0, 0, 0);
            }
        }

        this.mask_ptr1 = lib.malloc(this.C);
        this.mask_ptr2 = bin.new_bool_2d(this.state_len, this.rule_ptrs.length);
        this.queue_ptr = bin.new_queue(
            4 * Uint16Array.BYTES_PER_ELEMENT,
            this.state_len * this.C
        );
    }

    get potentials() {
        return this.lib.typed_array(
            Int32Array,
            this.potential_ptr,
            this.state_len * this.C
        );
    }

    get future() {
        return this.lib.typed_array(
            Int32Array,
            this.future_ptr,
            this.state_len
        );
    }

    computeFutureSetPresent(state: Uint8Array) {
        if (state.length !== this.state_len)
            throw new Error("State length mismatch");
        this.lib.copy_from_external(state, this.state_ptr);

        const result = Boolean(
            this.lib.exports.compute_future_set_present(
                this.state_ptr,
                this.future_ptr,
                this.obs_ptr,
                this.state_len,
                this.C,
                this.mask_ptr1
            )
        );

        this.lib.copy_to_external(this.state_ptr, state, this.state_len);
        return result;
    }

    computeBackwardPotentials(MX: number, MY: number, MZ: number) {
        if (MX * MY * MZ !== this.state_len)
            throw new Error("State dimension mismatch");

        return this.lib.exports.compute_bd(
            this.potential_ptr,
            this.future_ptr,
            this.queue_ptr,
            this.mask_ptr2,
            MX,
            MY,
            MZ,
            this.C,
            this.rule_tbl,
            this.rule_ptrs.length
        );
    }
}
