import { Renderer } from "./abstract";
import regl from "regl";
import { Vixel } from "./lib/vixel";
import CameraRotator from "./lib/input";

export class VoxelPathTracer extends Renderer {
    private static readonly canvas = document.createElement("canvas");
    public static readonly gfx = regl({
        canvas: VoxelPathTracer.canvas,
        optionalExtensions: [
            "OES_texture_float",
            "OES_texture_half_float",
            "WEBGL_color_buffer_float",
            "EXT_color_buffer_half_float",
        ],
        attributes: {
            antialias: false,
            preserveDrawingBuffer: true,
        },
    });
    private static readonly cam_ctrl = new CameraRotator(this.canvas);

    public static supported = false;
    public static readonly colorType: "float" | "half float" = (() => {
        if (
            this.gfx.hasExtension("OES_texture_float") &&
            this.gfx.hasExtension("WEBGL_color_buffer_float")
        ) {
            this.supported = true;
            return "float";
        }
        if (
            this.gfx.hasExtension("OES_texture_half_float") ||
            this.gfx.hasExtension("EXT_color_buffer_half_float")
        ) {
            this.supported = true;
            return "half float";
        }
        return null;
    })();

    private raf = 0;
    private readonly vixel: Vixel;
    public samples = 16;

    private MX: number;
    private MY: number;
    private MZ: number;

    constructor() {
        super();

        this.canvas.width = 512;
        this.canvas.height = 512;

        this.canvas.style.width = "512px";
        this.canvas.style.height = "512px";

        this.vixel = new Vixel(
            this.canvas,
            VoxelPathTracer.gfx,
            VoxelPathTracer.colorType
        );
        VoxelPathTracer.cam_ctrl.camera = this.vixel.camera;

        this.vixel.dof(0.5, 0.25);
        this.vixel.sun(17, (1.5 * Math.PI) / 2, 1, 1);

        this.clear();
        this.raf = requestAnimationFrame(() => this.loop());
    }

    private loop() {
        this.vixel.sample(this.samples);
        this.vixel.display();
        this.raf = requestAnimationFrame(() => this.loop());
    }

    public setCharacters(chars: string) {
        super.setCharacters(chars);

        const { characters, colors, vixel } = this;

        for (let i = 0; i < characters.length; i++) {
            const c = characters.charAt(i);
            const [r, g, b] = colors.subarray(i * 4, i * 4 + 3);

            if (c === "Y") {
                vixel.stage.setMaterial(i, r, g, b, 0.5, 0.5, 2);
            } else if (c === "U") {
                vixel.stage.setMaterial(i, r, g, b, 0, 0.25, 0, 1, 1.333);
            } else {
                vixel.stage.setMaterial(i, r, g, b);
            }
        }

        vixel.stage.updateBuffers();
    }

    override get canvas(): HTMLCanvasElement {
        return VoxelPathTracer.canvas;
    }

    override update(MX: number, MY: number, MZ: number) {
        if (this.MX === MX && this.MY === MY && this.MZ === MZ) return;
        this.MX = MX;
        this.MY = MY;
        this.MZ = MZ;

        this.vixel.camera.azimuth = -45;
        this.vixel.camera.incline = 30;
        this.vixel.camera.center.set([MX / 2, MZ / 2, MY / 2]);
        this.vixel.camera.distance = Math.sqrt(MX * MX + MY * MY + MZ * MZ);

        this.vixel.stage.resize([MX, MZ, MY]); // from Z-up to Y-up
    }

    override render(state: Uint8Array) {
        this.vixel.grid(state);
    }

    override clear() {
        this.vixel.stage.clearGrid();
    }

    override dispose() {
        cancelAnimationFrame(this.raf);
        this.vixel.destroy();
    }
}
