import { Renderer } from "./abstract";
import regl from "regl";
import { Vixel } from "./lib/vixel";
import CameraRotator from "./lib/input";
import { makeObservable, override } from "mobx";
import { Loader } from "../loader";

export class VoxelPathTracer extends Renderer {
    private static readonly canvas = Loader.makeCanvas();
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
    public static readonly gpu_spec = (() => {
        const ext = this.gfx._gl?.getExtension("WEBGL_debug_renderer_info");
        if (!ext) return null;

        const spec = this.gfx._gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        console.log(`GPU: ${spec}`);
        return spec;
    })();
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
    public readonly samples = 16;

    public fxaa = true;

    private MX: number;
    private MY: number;
    private MZ: number;

    constructor() {
        super();

        const resolution =
            screen.width <= 1280 ? 256 : screen.width <= 1920 ? 512 : 1024;

        this.canvas.width = resolution;
        this.canvas.height = resolution;

        this.vixel = new Vixel(
            this.canvas,
            VoxelPathTracer.gfx,
            VoxelPathTracer.colorType
        );
        VoxelPathTracer.cam_ctrl.camera = this.vixel.camera;

        this.vixel.dof(0.5, 0);
        // 10am, good time to go to sleep
        this.vixel.sun(10, (1.5 * Math.PI) / 2, 1, 0.05);

        this.clear();
        this.raf = requestAnimationFrame(() => this.loop());

        makeObservable(this);
    }

    private loop() {
        this.vixel.sample();
        this.vixel.display(this.fxaa);
        this.raf = requestAnimationFrame(() => this.loop());
    }

    @override
    public override setCharacters(chars: string) {
        super.setCharacters(chars);
        this.updateMaterial();
    }

    @override
    public override updateColors() {
        super.updateColors();
        this.updateMaterial();
    }

    private updateMaterial() {
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
        const dist = Math.sqrt(MX * MX + MY * MY + MZ * MZ);

        this.vixel.camera.azimuth = -45;
        this.vixel.camera.incline = 30;

        if (MZ > MX && MZ > MY) {
            this.vixel.camera.center.set([MX / 2, MZ / 2, MY / 2]);
        } else {
            this.vixel.camera.center.set([MX / 2, MZ / 4, MY / 2]);
        }

        this.vixel.camera.maxDistance = dist * 2;
        this.vixel.camera.distance = dist;

        this.vixel.stage.resize([MX, MZ, MY]); // from Z-up to Y-up
    }

    override _render(state: Uint8Array) {
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
