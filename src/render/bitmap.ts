import { Renderer } from ".";

export class BitmapRenderer extends Renderer {
    private static _canvas = document.createElement("canvas");
    private static _ctx = BitmapRenderer._canvas.getContext("2d");

    private MX: number;
    private MY: number;
    private img: ImageData;

    constructor() {
        super();
        this.canvas.style.imageRendering = "pixelated";
        this.canvas.style.objectFit = "contain";
    }

    public override get canvas(): HTMLCanvasElement {
        return BitmapRenderer._canvas;
    }

    private get ctx() {
        return BitmapRenderer._ctx;
    }

    override update(MX: number, MY: number, _: number) {
        if (this.MX === MX && this.MY === MY) return;

        this.MX = MX;
        this.MY = MY;
        this.img = new ImageData(MX, MY);
    }

    // TODO: use wasm to speed up? or just color it on GPU w shaders
    override _render(state: Uint8Array) {
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

        canvas.style.width = "256px";
        ctx.putImageData(img, 0, 0);
    }

    override clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    override dispose() {}
}
