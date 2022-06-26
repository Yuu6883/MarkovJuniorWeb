export interface Renderer {
    set palette(colors: Map<string, Uint8ClampedArray>);
    set characters(chars: string);
    update(MX: number, MY: number, MZ: number);
    render(state: Uint8Array);
    clear();
}

export class BitmapRenderer implements Renderer {
    private MX: number;
    private MY: number;
    private img: ImageData;
    private colors: Uint8Array;

    private _chars: string;
    private _palette: Map<string, Uint8ClampedArray>;

    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
    }

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

    update(MX: number, MY: number, _: number) {
        if (this.MX !== MX || this.MY !== MY) {
            this.MX = MX;
            this.MY = MY;
            this.img = new ImageData(MX, MY);
        }
    }

    // TODO: use wasm to speed up? or just color it on GPU w shaders
    render(state: Uint8Array) {
        const { MX, MY, img, colors, canvas, ctx } = this;
        if (!canvas || !ctx || !colors || !img) return;

        const { data } = img;

        const total = MX * MY;
        for (let offset = 0; offset < total; offset++) {
            const c = state[offset] << 2;
            const o = offset << 2;

            // imagine simd in js ):
            data[o + 0] = colors[c + 0];
            data[o + 1] = colors[c + 1];
            data[o + 2] = colors[c + 2];
            data[o + 3] = colors[c + 3];
        }

        canvas.width = MX;
        canvas.height = MY;

        canvas.style.width = `${MX}px`;
        canvas.style.height = `${MY}px`;
        ctx.putImageData(img, 0, 0);
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

export class IsometricRenderer implements Renderer {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
    }
    set characters(chars: string) {
        throw new Error("Method not implemented.");
    }
    set palette(colors: Map<string, Uint8ClampedArray>) {
        throw new Error("Method not implemented.");
    }
    update(MX: number, MY: number, MZ: number) {
        throw new Error("Method not implemented.");
    }
    render(state: Uint8Array) {
        throw new Error("Method not implemented.");
    }
    clear() {
        throw new Error("Method not implemented.");
    }
}
