import Renderer from "./render";
import Stage from "./stage";
import Camera from "./camera";
import { ReadonlyVec3, vec2, vec3 } from "gl-matrix";
import { FramebufferColorDataType, Regl } from "regl";

const MAX_SAMPLE = 4096 * 4; // eh

export class Vixel {
    private readonly _canvas: HTMLCanvasElement;
    private readonly _renderer: any;

    public readonly camera: Camera;

    public readonly stage: Stage;

    private readonly _ground = {
        color: <vec3>[0.8, 0.8, 0.8],
        rough: 1,
        metal: 0,
    };
    private readonly _sun = {
        time: 6,
        azimuth: 0,
        radius: 8,
        intensity: 1,
    };

    private readonly _dof = {
        distance: 0.5,
        magnitude: 0,
    };

    private _renderDirty = true;
    private oldDim: vec2;

    private frame = 0;
    private last_render = performance.now();
    private dynamicSamples = 1;

    constructor(
        canvas: HTMLCanvasElement,
        regl: Regl,
        colorType: FramebufferColorDataType
    ) {
        this._canvas = canvas;
        this._renderer = Renderer(regl, colorType);
        this.stage = new Stage(this._renderer.context);
        this.camera = new Camera();

        this.oldDim = [this._canvas.width, this._canvas.height];
    }

    get sampleCount() {
        return <number>this._renderer.sampleCount();
    }

    ground(color: ReadonlyVec3, r: number, m: number) {
        vec3.copy(this._ground.color, color);
        this._ground.rough = r;
        this._ground.metal = m;
        this._renderDirty = true;
    }

    sun(time: number, azimuth: number, radius: number, intensity: number) {
        this._sun.time = time;
        this._sun.azimuth = azimuth;
        this._sun.radius = radius;
        this._sun.intensity = intensity;
        this._renderDirty = true;
    }

    dof(distance: number, magnitude: number) {
        this._dof.distance = distance;
        this._dof.magnitude = magnitude;
        this._renderDirty = true;
    }

    grid(g: Uint8Array) {
        this.stage.setGrid(g);
        this._renderDirty = true;
    }

    sample() {
        this.frame++;

        if (
            this.oldDim[0] !== this._canvas.width ||
            this.oldDim[1] !== this._canvas.height
        ) {
            this.oldDim[0] = this._canvas.width;
            this.oldDim[1] = this._canvas.height;
            this._renderDirty = true;
        }

        this.camera.aspect = this._canvas.width / this._canvas.height;
        if (this.camera.update()) this._renderDirty = true;

        const CD = 4;

        if (this._renderDirty && !(this.frame % CD)) {
            this._renderer.reset();
            this._renderDirty = false;
        }

        if (this._renderer.sampleCount() >= MAX_SAMPLE) return;

        const dt = performance.now() - this.last_render;
        this.last_render = performance.now();

        if (dt > 1000 / 30) {
            this.dynamicSamples = Math.max(1, this.dynamicSamples - 1);
        } else if (dt < 1000 / 60) {
            if (this.sampleCount > 1) {
                this.dynamicSamples = Math.min(32, this.dynamicSamples + 1);
            }
        }

        this._renderer.sample(this.stage, this.camera, {
            groundColor: this._ground.color,
            groundRoughness: this._ground.rough,
            groundMetalness: this._ground.metal,
            time: this._sun.time,
            azimuth: this._sun.azimuth,
            lightRadius: this._sun.radius,
            lightIntensity: this._sun.intensity,
            dofDist: this._dof.distance,
            dofMag: this._dof.magnitude,
            count: this.dynamicSamples,
        });

        this.ocd = true;
    }

    private ocd = true;

    display(fxaa: boolean) {
        const total = this._renderer.sampleCount();
        if (total >= MAX_SAMPLE && !this.ocd) return;

        if (total >= MAX_SAMPLE) {
            this.ocd = false;
            this._renderer.display(0, fxaa);
        } else this._renderer.display(total / MAX_SAMPLE, fxaa);
    }

    destroy() {
        this.stage.tIndex.destroy();
        this.stage.tRGB.destroy();
        this.stage.tRMET.destroy();
        this.stage.tRi.destroy();
        this._renderer.destroy();
    }
}
