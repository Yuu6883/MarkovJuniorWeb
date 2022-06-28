import { Framebuffer2D, FramebufferColorDataType, Regl } from "regl";

export class PingPongTextures {
    private readonly fbo: [Framebuffer2D, Framebuffer2D];
    private index = 0;

    private width: number;
    private height: number;

    constructor(
        width: number,
        height: number,
        gfx: Regl,
        colorType: FramebufferColorDataType
    ) {
        this.width = width;
        this.height = height;

        const option = {
            width,
            height,
            colorType,
        };
        this.fbo = [gfx.framebuffer(option), gfx.framebuffer(option)];
    }

    get ping() {
        return this.fbo[this.index];
    }

    get pong() {
        return this.fbo[1 - this.index];
    }

    swap() {
        this.index = 1 - this.index;
    }

    resize(width: number, height: number) {
        if (width <= this.width && height <= this.height) return;
        this.ping.resize(width, height);
        this.pong.resize(width, height);
    }
}
