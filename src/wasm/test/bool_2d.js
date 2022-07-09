const load = require("./common");

(async () => {
    const { exports: e } = await load("v2.wasm");
    console.log(e);

    const mat_ptr = e.new_bool_2d(5, 5);

    const print = () => {
        console.log("board: ");
        for (let y = 0; y < 5; y++) {
            let str = "";
            for (let x = 0; x < 5; x++) {
                str += e.bool_2d_get(mat_ptr, x, y) ? "x" : ".";
            }
            console.log(str);
        }
        console.log();
    };

    console.log(". -> x");
    print();
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
            e.bool_2d_set(mat_ptr, x, y, true);
            print();
        }
    }

    console.log("x -> .");
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
            e.bool_2d_set(mat_ptr, x, y, false);
            print();
        }
    }

    console.log("fill");
    e.bool_2d_fill(mat_ptr);
    print();

    console.log("clear");
    e.bool_2d_clear(mat_ptr);
    print();
})();
