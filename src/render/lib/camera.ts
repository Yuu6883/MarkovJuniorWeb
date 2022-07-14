import { glMatrix, mat4, ReadonlyMat4, ReadonlyVec3, vec3 } from "gl-matrix";

const UP = new Float32Array([0, 1, 0]);

export default class Camera {
    public fov = 0;
    public aspect = 0;
    public nearClip = 0;
    public farClip = 0;

    private _distance = 0;
    public maxDistance = 0;

    public set distance(value: number) {
        this._distance = Math.max(0.001, Math.min(value, this.maxDistance));
    }

    public get distance() {
        return this._distance;
    }

    public azimuth = -45;
    public incline = 30;

    public readonly center = new Float32Array(3);

    private readonly _buf = new Float32Array(16 + 16 + 4);

    constructor() {
        this.reset();
    }

    public get view() {
        return <ReadonlyMat4>this._buf.subarray(0, 16);
    }

    public get inverse() {
        return <ReadonlyMat4>this._buf.subarray(16, 32);
    }

    public get position() {
        return <ReadonlyVec3>this._buf.subarray(32, 32 + 3);
    }

    public update() {
        const old = this._buf.slice();

        const rot = mat4.create();

        const rotX = mat4.fromYRotation(
            mat4.create(),
            glMatrix.toRadian(-this.azimuth)
        );
        const rotY = mat4.fromXRotation(
            mat4.create(),
            glMatrix.toRadian(-this.incline)
        );
        mat4.mul(rot, rotX, rotY);

        const world = mat4.create();
        world[14] = this._distance;

        const final = mat4.mul(mat4.create(), rot, world);

        const pos = this._buf.subarray(32, 32 + 3);
        mat4.getTranslation(pos, final);
        vec3.add(pos, pos, this.center);

        const view = mat4.lookAt(mat4.create(), pos, this.center, UP);

        const proj = mat4.perspective(
            mat4.create(),
            glMatrix.toRadian(this.fov),
            this.aspect,
            this.nearClip,
            this.farClip
        );

        mat4.mul(this._buf, proj, view);
        mat4.invert(this._buf.subarray(16), this._buf);

        for (let i = 0; i < old.length; i++) {
            if (this._buf[i] !== old[i]) return true;
        }
        return false;
    }

    public reset() {
        this.fov = 60;
        this.aspect = 1.33;
        this.nearClip = 0.1;
        this.farClip = 1000;

        this._distance = 10;
        this.maxDistance = 1000;
        this.azimuth = -45;
        this.incline = 30;

        this.center.fill(0);
        this.update();
    }
}
