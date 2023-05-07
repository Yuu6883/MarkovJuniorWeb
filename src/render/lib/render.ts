import { vec3 } from "gl-matrix";
import createAtmosphereRenderer from "regl-atmosphere-envmap";
import { PingPongTextures } from "./pingpong";
import { Framebuffer2D, FramebufferColorDataType, Regl, Texture2D } from "regl";

import SampleVert from "./glsl/sample.vert";
import SampleFrag from "./glsl/sample.frag";
import DisplayVert from "./glsl/display.vert";
import DisplayFrag from "./glsl/display.frag";
import Stage from "./stage";
import Camera from "./camera";

const TexCache: {
    t2Sphere?: Texture2D;
    t3Sphere?: Texture2D;
    tUniform1?: Texture2D;
    tUniform2?: Texture2D;
    previewFBO?: Framebuffer2D;
} = {};

export const clearTexCache = () => {
    TexCache.t2Sphere && TexCache.t2Sphere.destroy();
    TexCache.t3Sphere && TexCache.t3Sphere.destroy();
    TexCache.tUniform1 && TexCache.tUniform1.destroy();
    TexCache.tUniform2 && TexCache.tUniform2.destroy();
    TexCache.previewFBO && TexCache.previewFBO.destroy();

    TexCache.t2Sphere = null;
    TexCache.t3Sphere = null;
    TexCache.tUniform1 = null;
    TexCache.tUniform2 = null;
    TexCache.previewFBO = null;
};

const Renderer = (regl: Regl, colorType: FramebufferColorDataType) => {
    const canvas = regl._gl.canvas;

    const sunDistance = 149600000000;
    let sunPosition = vec3.scale(
        vec3.create(),
        vec3.normalize(vec3.create(), [1.11, -0.0, 0.25]),
        sunDistance
    );

    const renderAtmosphere = createAtmosphereRenderer(regl);
    const skyMap = renderAtmosphere({
        sunDirection: vec3.normalize(vec3.create(), sunPosition),
        resolution: 1024,
    });

    const pingpong = new PingPongTextures(
        canvas.width,
        canvas.height,
        regl,
        colorType
    );

    const ndcBox = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];

    const tRandSize = 1024;

    TexCache.t2Sphere ||= (() => {
        const data = new Float32Array(tRandSize * tRandSize * 3);
        for (let i = 0; i < tRandSize * tRandSize; i++) {
            const r = vec3.random(vec3.create());
            data[i * 3 + 0] = r[0];
            data[i * 3 + 1] = r[1];
            data[i * 3 + 2] = r[2];
        }
        return regl.texture({
            width: tRandSize,
            height: tRandSize,
            format: "rgb",
            type: "float",
            data: data,
            wrap: "repeat",
        });
    })();

    TexCache.t3Sphere ||= (() => {
        const data = new Float32Array(tRandSize * tRandSize * 3);
        for (let i = 0; i < tRandSize * tRandSize; i++) {
            const r = vec3.random(vec3.create(), Math.random());
            data[i * 3 + 0] = r[0];
            data[i * 3 + 1] = r[1];
            data[i * 3 + 2] = r[2];
        }
        return regl.texture({
            width: tRandSize,
            height: tRandSize,
            format: "rgb",
            type: "float",
            data: data,
            wrap: "repeat",
        });
    })();

    TexCache.tUniform2 ||= (() => {
        const data = new Float32Array(tRandSize * tRandSize * 2);
        for (let i = 0; i < tRandSize * tRandSize; i++) {
            data[i * 2 + 0] = Math.random();
            data[i * 2 + 1] = Math.random();
        }
        return regl.texture({
            width: tRandSize,
            height: tRandSize,
            format: "luminance alpha",
            type: "float",
            data: data,
            wrap: "repeat",
        });
    })();

    TexCache.tUniform1 ||= (() => {
        const data = new Float32Array(tRandSize * tRandSize * 1);
        for (let i = 0; i < tRandSize * tRandSize; i++) {
            data[i] = Math.random();
        }
        return regl.texture({
            width: tRandSize,
            height: tRandSize,
            format: "luminance",
            type: "float",
            data: data,
            wrap: "repeat",
        });
    })();

    TexCache.previewFBO ||= regl.framebuffer({
        width: canvas.width,
        height: canvas.height,
        colorType,
    });

    // @ts-expect-error
    const prop = (name: string) => regl.prop(name);

    const cmdSample = regl({
        vert: SampleVert,
        frag: SampleFrag,
        attributes: {
            position: ndcBox,
        },
        uniforms: {
            source: prop("source"),
            invpv: prop("invpv"),
            eye: prop("eye"),
            res: prop("res"),
            resFrag: prop("resFrag"),
            tSky: skyMap,
            tUniform1: TexCache.tUniform1,
            tUniform2: TexCache.tUniform2,
            t2Sphere: TexCache.t2Sphere,
            t3Sphere: TexCache.t3Sphere,
            tOffset: prop("tOffset"),
            tRGB: prop("tRGB"),
            tRMET: prop("tRMET"),
            tRi: prop("tRi"),
            tIndex: prop("tIndex"),
            dofDist: prop("dofDist"),
            dofMag: prop("dofMag"),
            resStage: prop("resStage"),
            invResRand: [1 / tRandSize, 1 / tRandSize],
            lightPosition: prop("lightPosition"),
            lightIntensity: prop("lightIntensity"),
            lightRadius: prop("lightRadius"),
            groundColor: prop("groundColor"),
            groundRoughness: prop("groundRoughness"),
            groundMetalness: prop("groundMetalness"),
            bounds: prop("bounds"),
            renderPreview: prop("renderPreview"),
        },
        depth: {
            enable: false,
            mask: false,
        },
        viewport: prop("viewport"),
        framebuffer: prop("destination"),
        count: 6,
    });

    const cmdDisplay = regl({
        vert: DisplayVert,
        frag: DisplayFrag,
        attributes: {
            position: ndcBox,
        },
        uniforms: {
            source: prop("source"),
            preview: prop("preview"),
            fraction: prop("fraction"),
            complete: prop("complete"),
            resolution: prop("resolution"),
            enable_fxaa: prop("enable_fxaa"),
            tUniform1: TexCache.tUniform1,
            tUniform1Res: [TexCache.tUniform1.width, TexCache.tUniform1.height],
        },
        depth: {
            enable: false,
            mask: false,
        },
        viewport: prop("viewport"),
        count: 6,
    });

    function calculateSunPosition(time: number, azimuth: number): vec3 {
        const theta = (2 * Math.PI * (time - 6)) / 24;
        return [
            sunDistance * Math.cos(azimuth) * Math.cos(theta),
            sunDistance * Math.sin(theta),
            sunDistance * Math.sin(azimuth) * Math.cos(theta),
        ];
    }

    let sampleCount = 0;

    function sample(
        stage: Stage,
        camera: Camera,
        opts: {
            time: number;
            azimuth: number;
            count: number;
            lightIntensity: number;
            lightRadius: number;
            groundRoughness: number;
            groundColor: number;
            groundMetalness: number;
            dofDist: number;
            dofMag: number;
        },
        previewOnly = false
    ) {
        const sp = calculateSunPosition(opts.time, opts.azimuth);
        if (vec3.distance(sp, sunPosition) > 0.001) {
            sunPosition = sp;
            renderAtmosphere({
                sunDirection: vec3.normalize(vec3.create(), sunPosition),
                cubeFBO: skyMap,
            });
        }
        for (let i = 0; i < (previewOnly ? 1 : opts.count); i++) {
            cmdSample({
                eye: camera.position,
                invpv: camera.inverse,
                res: [canvas.width, canvas.height],
                tOffset: [Math.random(), Math.random()],
                tRGB: stage.tRGB,
                tRMET: stage.tRMET,
                tRi: stage.tRi,
                tIndex: stage.tIndex,
                resStage: stage.tIndex.width,
                bounds: stage.dim,
                lightPosition: sunPosition,
                lightIntensity: opts.lightIntensity,
                lightRadius: 695508000 * opts.lightRadius,
                groundRoughness: opts.groundRoughness,
                groundColor: opts.groundColor,
                groundMetalness: opts.groundMetalness,
                dofDist: opts.dofDist,
                dofMag: opts.dofMag,
                renderPreview: previewOnly || sampleCount === 0,
                source: pingpong.ping,
                destination: sampleCount ? pingpong.pong : TexCache.previewFBO,
                viewport: {
                    x: 0,
                    y: 0,
                    width: canvas.width,
                    height: canvas.height,
                },
            });

            pingpong.swap();
            sampleCount++;

            if (sampleCount === 1) break;
        }
    }

    function display(complete: number, fxaa: boolean) {
        const fraction = Math.pow(Math.min(1.0, sampleCount / 512), 2);

        cmdDisplay({
            source: pingpong.ping,
            preview: TexCache.previewFBO,
            complete,
            fraction,
            resolution: [canvas.width, canvas.height],
            enable_fxaa: fxaa,
            viewport: {
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height,
            },
        });
    }

    let w = canvas.width;
    let h = canvas.height;

    function reset() {
        if (w < canvas.width || h < canvas.height) {
            pingpong.ping({
                width: w,
                height: h,
                colorType,
            });
            pingpong.pong({
                width: canvas.width,
                height: canvas.height,
                colorType,
            });
            TexCache.previewFBO({
                width: canvas.width,
                height: canvas.height,
                colorType,
            });
            w = canvas.width;
            h = canvas.height;
        }
        regl.clear({ color: [0, 0, 0, 1], framebuffer: pingpong.ping });
        regl.clear({ color: [0, 0, 0, 1], framebuffer: pingpong.pong });
        sampleCount = 0;
    }

    return {
        context: regl,
        sample,
        display,
        reset,
        sampleCount: () => sampleCount,
        destroy: () => {
            pingpong.ping.destroy();
            pingpong.pong.destroy();
        },
    };
};

export default Renderer;
