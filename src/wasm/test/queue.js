const load = require("./common");

(async () => {
    const { exports: e, alloc } = await load("v2.wasm");

    const queue_ptr = e.new_queue(1, 6);
    console.log(`queue_ptr = ${queue_ptr}`);

    const enqueue = (item) => {
        const item_ptr = e.queue_push(queue_ptr);
        alloc.copy_from_external(item, item_ptr);

        return e.queue_len(queue_ptr);
    };

    const dequeue = () => {
        const item_ptr = e.queue_pop(queue_ptr);
        const out = new Uint8Array(1);
        alloc.copy_to_external(item_ptr, out);

        return out[0];
    };

    console.log(e.queue_elem(queue_ptr));
    console.log(e.queue_capacity(queue_ptr));
    console.log(e.queue_len(queue_ptr));

    const item1 = new Uint8Array([0]);
    const item2 = new Uint8Array([1]);
    const item3 = new Uint8Array([2]);

    console.log("Enqueue");
    console.log(item1[0], enqueue(item1));
    console.log(item2[0], enqueue(item2));
    console.log(item3[0], enqueue(item3));

    for (let i = 0; i < 5; i++) {
        item1[0] = i * 3 + 0;
        item2[0] = i * 3 + 1;
        item3[0] = i * 3 + 2;

        console.log("Enqueue");
        console.log(item1[0], enqueue(item1));
        console.log(item2[0], enqueue(item2));
        console.log(item3[0], enqueue(item3));

        console.log("Dequeue");
        console.log(dequeue());
        console.log(dequeue());
        console.log(dequeue());
    }

    console.log("Dequeue");
    console.log(dequeue());
    console.log(dequeue());
    console.log(dequeue());
})();
