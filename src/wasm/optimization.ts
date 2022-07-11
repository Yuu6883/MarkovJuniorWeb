import { WasmInstance, WasmModule } from ".";
import { Rule } from "../rule";

import ObsModuleURL from "../bin/rule.wasm";

export class Optimization {
    static get supported() {
        return !!this.obs_instance;
    }

    static obs_instance: WasmInstance;

    static loadPromise = (async () => {
        {
            const res = await fetch(ObsModuleURL);
            const buffer = await res.arrayBuffer();

            const vm = await WasmModule.load(buffer);
            const vi = await vm.init();

            this.obs_instance = vi;
        }
    })().catch((_) => (this.obs_instance = null));

    static load_rule(rule: Rule) {
        const lib = this.obs_instance;
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

        // Compare wasm memory with js
        /*
        console.log(shift_size, ishift_count, oshift_count);

        bin.log_rule_ishift(ptr);
        console.log(
            ishifts
                .map((v, i) =>
                    v.map((vv) => `shift: [${i},${vv.join(",")}]`).join()
                )
                .join("\n")
        );
        
        bin.log_rule_oshift(ptr);
        console.log(
            oshifts
                .map((v, i) =>
                    v.map((vv) => `shift: [${i},${vv.join(",")}]`).join()
                )
                .join("\n")
        );

        */
        return ptr;
    }
}
