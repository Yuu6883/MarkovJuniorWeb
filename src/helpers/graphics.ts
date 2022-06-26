import { OneNode, RuleNode } from "../nodes";

const RED = new Uint8ClampedArray([255, 0, 0]);

export class Graphics {
    private static canvas: HTMLCanvasElement;
    private static ctx: CanvasRenderingContext2D;

    static init(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", {});
    }

    static async loadBitmap(
        url: string
    ): Promise<[Int32Array, number, number, number]> {
        try {
            const response = await fetch(url);
            const fileBlob = await response.blob();
            const bitmap = await createImageBitmap(fileBlob);

            const canvas = document.createElement("canvas");

            canvas.width = bitmap.width;
            canvas.height = bitmap.height;

            const context = canvas.getContext("2d");
            context.drawImage(bitmap, 0, 0);
            bitmap.close();

            const { data, width, height } = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

            return [new Int32Array(data.buffer), width, height, 1];
        } catch (e) {
            console.error(e);
            return [null, -1, -1, -1];
        }
    }

    // TODO: use wasm to speed up? or just color it on GPU w shaders
    static async renderBitmap(
        state: Uint8Array,
        MX: number,
        MY: number,
        colors: Uint8ClampedArray[],
        pixelsize: number
    ) {
        const img = new ImageData(MX, MY);

        const total = MX * MY;
        for (let offset = 0; offset < total; offset++) {
            img.data.set(colors[state[offset]], offset << 2);
        }

        if (this.canvas) {
            const w = MX * pixelsize;
            const h = MY * pixelsize;

            this.canvas.width = w;
            this.canvas.height = h;

            this.canvas.style.width = `${w}px`;
            this.canvas.style.height = `${h}px`;
            this.ctx?.drawImage(
                await createImageBitmap(img, {
                    resizeWidth: w,
                    resizeHeight: h,
                    resizeQuality: "pixelated",
                }),
                0,
                0
            );
        }
    }

    static renderIsometric() {}

    static clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
