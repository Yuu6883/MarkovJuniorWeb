import { WasmInstance, WasmModule } from ".";
import { Rule } from "../rule";

export class Optimization {
    static get supported() {
        // return false; // for comparing js&wasm output
        return !!this.module;
    }

    static get inline_limit() {
        return 128;
    }

    static module: WasmModule;
    static loadPromise: Promise<void>;

    static load_rule(lib: WasmInstance, rule: Rule) {
        const bin = lib.exports;

        const { ishifts, oshifts, C } = rule;
        const [IMX, IMY, IMZ, OMX, OMY, OMZ] = rule.IO_DIM;

        const ishift_count = ishifts.reduce((prev, s) => prev + s.length, 0);
        const oshift_count = oshifts.reduce((prev, s) => prev + s.length, 0);

        const ptr = bin.new_rule(
            IMX,
            IMY,
            IMZ,
            OMX,
            OMY,
            OMZ,
            C,
            ishift_count,
            oshift_count
        );

        const shift_size = bin.shift_size();

        lib.copy_from_external(rule.binput, bin.rule_binput(ptr));
        lib.copy_from_external(rule.output, bin.rule_output(ptr));
        lib.copy_from_external(rule.input, bin.rule_input(ptr));

        const ishift_table_ptr = bin.rule_ishift_offset(ptr);
        const ishift_array_ptr = bin.rule_ishift_array(ptr);

        for (let offset = 0, c = 0, p = 0; c < ishifts.length; c++) {
            lib.view.setUint16(ishift_table_ptr + c * 2, p, true);
            for (const [shiftx, shifty, shiftz] of ishifts[c]) {
                lib.view.setUint16(ishift_array_ptr + offset + 0, shiftx, true);
                lib.view.setUint16(ishift_array_ptr + offset + 2, shifty, true);
                lib.view.setUint16(ishift_array_ptr + offset + 4, shiftz, true);
                offset += shift_size;
                p++;
            }
        }

        const oshift_table_ptr = bin.rule_oshift_offset(ptr);
        const oshift_array_ptr = bin.rule_oshift_array(ptr);

        for (let offset = 0, c = 0, p = 0; c < oshifts.length; c++) {
            lib.view.setUint16(oshift_table_ptr + c * 2, p, true);
            for (const [shiftx, shifty, shiftz] of oshifts[c]) {
                lib.view.setUint16(oshift_array_ptr + offset + 0, shiftx, true);
                lib.view.setUint16(oshift_array_ptr + offset + 2, shifty, true);
                lib.view.setUint16(oshift_array_ptr + offset + 4, shiftz, true);
                offset += shift_size;
                p++;
            }
        }
        return ptr;
    }
}
