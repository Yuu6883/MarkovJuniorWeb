import { vec3 } from "gl-matrix";
import { Regl, Texture2D } from "regl";

export default class Stage {
    private regl: Regl;

    private textureSize: number;

    dim: vec3;

    tIndex: Texture2D;
    tRGB: Texture2D;
    tRMET: Texture2D;
    tRi: Texture2D;

    private ind_buf: Uint8Array;
    private rgb_buf = new Uint8Array(256 * 256 * 3);
    private pbr_buf = new Float32Array(256 * 256 * 4);
    private ri_buf = new Float32Array(256 * 256 * 4);

    constructor(regl: Regl) {
        this.regl = regl;

        this.tRGB = regl.texture({
            width: 256,
            height: 256,
            format: "rgb",
        });

        this.tRMET = regl.texture({
            width: 256,
            height: 256,
            format: "rgba",
            type: "float",
        });

        this.tRi = regl.texture({
            width: 256,
            height: 256,
            format: "rgba",
            type: "float",
        });

        this.resize([0, 0, 0]);
    }

    resize(dim: vec3) {
        const regl = this.regl;

        this.dim = dim;
        this.textureSize = 1;
        while (
            this.textureSize * this.textureSize <
            this.dim[0] * this.dim[1] * this.dim[2]
        ) {
            this.textureSize *= 2;
        }
        this.ind_buf = new Uint8Array(this.textureSize * this.textureSize * 2);

        this.tIndex = regl.texture({
            width: this.textureSize,
            height: this.textureSize,
            format: "luminance alpha",
        });
    }

    setMaterial(
        index: number,
        r: number,
        g: number,
        b: number,
        roughness = 1,
        metallic = 0,
        emission = 0,
        translucency = 0,
        refract = 1
    ) {
        this.rgb_buf[index * 3 + 0] = r;
        this.rgb_buf[index * 3 + 1] = g;
        this.rgb_buf[index * 3 + 2] = b;
        this.pbr_buf[index * 4 + 0] = roughness;
        this.pbr_buf[index * 4 + 1] = metallic;
        this.pbr_buf[index * 4 + 2] = emission;
        this.pbr_buf[index * 4 + 3] = translucency;
        this.ri_buf[index * 4 + 0] = refract;
    }

    setGrid(grid: Uint8Array) {
        for (let i = 0; i < grid.length; i++) {
            this.ind_buf[i * 2] = grid[i];
        }
        this.tIndex.subimage(this.ind_buf);
    }

    updateBuffers() {
        this.tRGB.subimage(this.rgb_buf);
        this.tRMET.subimage(this.pbr_buf);
        this.tRi.subimage(this.ri_buf);
    }

    clearMaterial() {
        this.rgb_buf.fill(0);
        this.pbr_buf.fill(0);
        this.ri_buf.fill(0);
    }

    clearGrid() {
        this.ind_buf.fill(0);
        this.tIndex.subimage(this.ind_buf);
    }
}
