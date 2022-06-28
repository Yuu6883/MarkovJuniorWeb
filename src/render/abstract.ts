export abstract class Renderer {
    private _chars: string;
    private _palette: Map<string, Uint8ClampedArray>;
    protected colors: Uint8Array;

    public abstract get canvas(): HTMLCanvasElement;

    set characters(chars: string) {
        if (this._chars !== chars) {
            this._chars = chars;

            const colorArr = chars.split("").map((c) => this._palette.get(c));
            this.colors = new Uint8Array(colorArr.length * 4);
            for (let i = 0; i < colorArr.length; i++) {
                this.colors.set(colorArr[i], i * 4);
            }
        }
    }

    set palette(colors: Map<string, Uint8ClampedArray>) {
        this._palette = new Map([...colors.entries()]);
    }

    get palette() {
        return new Map([...this._palette.entries()]);
    }

    abstract update(MX: number, MY: number, MZ: number);
    abstract render(state: Uint8Array);
    abstract clear();
}
