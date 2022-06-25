import { VoxHelper } from "./vox";

export class Loader {
    static async xml(path: string) {
        const res = await fetch(path);
        if (res.status !== 200) return null;
        const text = await res.text();
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/xml");
            const node = doc.getRootNode();

            return node.firstChild as Element;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    static async vox(
        path: string
    ): Promise<[Int32Array, number, number, number]> {
        const res = await fetch(path);
        if (res.status !== 200) return [null, -1, -1, -1];
        const buf = await res.arrayBuffer();
        try {
            return VoxHelper.read(buf);
        } catch (e) {
            console.error(e);
            return [null, -1, -1, -1];
        }
    }
}
