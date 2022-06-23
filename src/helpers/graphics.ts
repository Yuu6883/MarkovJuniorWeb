export class Graphics {
    private static canvas: HTMLCanvasElement;
    private static ctx: ImageBitmapRenderingContext;

    static init(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("bitmaprenderer", {
            alpha: false,
        });
    }

    static loadBitmap(path: string): [Int32Array, number, number] {
        // TODO:
        return null;
    }

    static async renderBitmap(
        state: Uint8Array,
        MX: number,
        MY: number,
        colors: Uint8ClampedArray[],
        pixelsize: number
    ) {
        const img = new ImageData(MX, MY);

        for (let y = 0; y < MY; y++)
            for (let x = 0; x < MX; x++) {
                const offset = x + y * MX;
                const color = colors[state[offset]];
                img.data.set(color, offset << 2);
            }

        if (this.canvas) {
            this.canvas.width = MX;
            this.canvas.height = MY;
            this.canvas.style.width = `${MX}px`;
            this.canvas.style.height = `${MY}px`;
            this.ctx?.transferFromImageBitmap(await createImageBitmap(img));
        }
    }
}
