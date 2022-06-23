import { Rule } from "./rule";

export class Grid {
    public state: Uint8Array;
    public mask: Uint8Array; // bool array

    public MX: number;
    public MY: number;
    public MZ: number;

    public characters: string;
    public values: Map<number, number> = new Map();
    public waves: Map<number, number> = new Map();
    public folder: string;

    private transparent: number;
    private statebuffer: Uint8Array;

    public static load(elem: Element, MX: number, MY: number, MZ: number) {
        const g = new Grid();
        g.MX = MX;
        g.MY = MY;
        g.MZ = MZ;

        const valueString = elem.getAttribute("values")?.replaceAll(" ", "");
        if (!valueString) {
            console.error("no values specified");
            return null;
        }

        g.characters = valueString;
        for (let i = 0; i < g.alphabet_size; i++) {
            const c = valueString.charCodeAt(i);

            if (g.values.has(c)) {
                console.error(elem, "contains repeating value");
                return null;
            }

            g.values.set(c, i);
            g.waves.set(c, 1 << i);
        }

        g.state = new Uint8Array(MX * MY * MZ);
        g.statebuffer = new Uint8Array(MX * MY * MZ);
        g.mask = new Uint8Array(MX * MY * MZ);
        g.folder = elem.getAttribute("folder");

        return g;
    }

    get alphabet_size() {
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

    public matches(rule: Rule, x: number, y: number, z: number): boolean {
        const { MX, MY } = this;

        let dz = 0,
            dy = 0,
            dx = 0;
        for (let di = 0; di < rule.input.length; di++) {
            if (
                (rule.input[di] &
                    (1 <<
                        this.state[
                            x + dx + (y + dy) * MX + (z + dz) * MX * MY
                        ])) ==
                0
            )
                return false;

            dx++;
            if (dx == rule.IMX) {
                dx = 0;
                dy++;
                if (dy == rule.IMY) {
                    dy = 0;
                    dz++;
                }
            }
        }
        return true;
    }
}
