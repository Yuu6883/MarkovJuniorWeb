import { OneNode, RuleNode } from "../nodes";

const RED = new Uint8ClampedArray([255, 0, 0]);

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

    // TODO: use wasm to speed up? or just color it on GPU w shaders
    static async renderBitmap(
        state: Uint8Array,
        MX: number,
        MY: number,
        colors: Uint8ClampedArray[],
        pixelsize: number,
        debugNode?: RuleNode
    ) {
        const img = new ImageData(MX, MY);

        for (let y = 0; y < MY; y++)
            for (let x = 0; x < MX; x++) {
                const offset = x + y * MX;
                const color = colors[state[offset]];
                img.data.set(color, offset << 2);
            }

        if (debugNode) {
            for (const [, x, y] of debugNode.matches.slice(
                0,
                debugNode.matchCount
            )) {
                const offset = x + y * MX;
                img.data.set(RED, offset << 2);
            }
        }

        if (this.canvas) {
            const w = MX * pixelsize;
            const h = MY * pixelsize;

            this.canvas.width = w;
            this.canvas.height = h;

            this.canvas.style.width = `${w}px`;
            this.canvas.style.height = `${h}px`;
            this.ctx?.transferFromImageBitmap(
                await createImageBitmap(img, {
                    resizeWidth: w,
                    resizeHeight: h,
                    resizeQuality: "pixelated",
                })
            );
        }
    }
}
