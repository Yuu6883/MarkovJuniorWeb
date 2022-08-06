import { Helper } from "./helpers/helper";

export class Grid {
    public state: Uint8Array;
    public padded: Uint8Array;

    public mask: Uint8Array; // bool array

    public MX: number;
    public MY: number;
    public MZ: number;

    public characters: string;
    public values: Map<number, number> = new Map();
    public waves: Map<number, number> = new Map();
    public folder: string;

    private transparent: number;
    // private statebuffer: Uint8Array;

    public static build(elem: Element, MX: number, MY: number, MZ: number) {
        const g = new Grid();
        g.MX = MX;
        g.MY = MY;
        g.MZ = MZ;

        const valueString = elem.getAttribute("values")?.replaceAll(" ", "");
        if (!valueString) {
            console.error(elem, "no values specified");
            return null;
        }

        g.characters = valueString;
        for (let i = 0; i < g.C; i++) {
            const c = valueString.charCodeAt(i);

            if (g.values.has(c)) {
                console.error(elem, "contains repeating value");
                return null;
            }

            g.values.set(c, i);
            g.waves.set(c, 1 << i);
        }

        const transparentString = elem.getAttribute("transparent");
        if (transparentString) g.transparent = g.wave(transparentString);

        const unions = [
            ...Helper.matchTags(elem, "markov", "sequence", "union"),
        ].filter((x) => x.tagName === "union");
        g.waves.set("*".charCodeAt(0), (1 << g.C) - 1);

        for (const union of unions) {
            const symbol = union.getAttribute("symbol").charCodeAt(0);
            if (g.waves.has(symbol)) {
                console.error(
                    union,
                    `repeating union type "${String.fromCharCode(symbol)}"`
                );
                return null;
            } else {
                const w = g.wave(union.getAttribute("values"));
                g.waves.set(symbol, w);
            }
        }

        let pot = 1;
        while (pot < MX * MY * MZ) pot <<= 2;
        g.padded = new Uint8Array(pot);
        g.state = g.padded.subarray(0, MX * MY * MZ);
        // g.statebuffer = new Uint8Array(MX * MY * MZ);
        g.mask = new Uint8Array(MX * MY * MZ);
        g.folder = elem.getAttribute("folder");

        return g;
    }

    get C() {
        return this.characters.length;
    }

    public clear() {
        this.state.fill(0);
    }

    public wave(values: string) {
        let sum = 0;
        for (let i = 0; i < values.length; i++)
            sum += 1 << this.values.get(values.charCodeAt(i));
        return sum;
    }
}
