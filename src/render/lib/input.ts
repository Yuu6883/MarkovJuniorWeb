import Camera from "./camera";

const clamp = (n: number, min: number, max: number) =>
    n < min ? min : n > max ? max : n;

enum InputState {
    MOUSE_UP,
    MOUSE_DOWN,
}

enum InputButtons {
    MOUSE_LEFT = 0,
    MOUSE_MIDDLE = 1,
    MOUSE_RIGHT = 2,
}

export default class CameraRotator {
    private readonly pointers: Map<
        number,
        { nx: number; ny: number; ox: number; oy: number; ts: number }
    > = new Map();

    private cam: Camera;

    constructor(elem: HTMLElement) {
        elem.addEventListener("wheel", (e) => {
            if (!this.cam) return;
            this.onMouseWheel(e.deltaY);
        });

        elem.addEventListener("pointerdown", (e) => {
            if (!this.cam) return;

            if (this.pointers.size >= 2) return;

            this.pointers.set(e.pointerId, {
                nx: e.clientX,
                ny: e.clientY,
                ox: e.clientX,
                oy: e.clientY,
                ts: Date.now(),
            });
        });

        elem.addEventListener("pointermove", (e) => {
            if (!this.cam) return;

            this.onOnePointerMove(e.pointerId, e.clientX, e.clientY);
        });

        const up = (e: PointerEvent) => {
            if (!this.cam) return;
            this.pointers.delete(e.pointerId);
        };

        elem.addEventListener("pointercancel", up);
        elem.addEventListener("pointerleave", up);
        elem.addEventListener("pointerout", up);
        elem.addEventListener("pointerup", up);
    }

    set camera(value: Camera) {
        if (value) this.cam = value;
    }

    onMouseWheel(delta: number) {
        this.cam.distance *= 1 + delta / 1000;
    }

    onOnePointerMove(id: number, nx: number, ny: number) {
        const obj = this.pointers.get(id);
        if (!obj) return;

        const MaxDelta = 100;
        const dx = clamp(nx - obj.ox, -MaxDelta, MaxDelta);
        const dy = clamp(-(ny - obj.oy), -MaxDelta, MaxDelta);

        obj.ox = obj.nx;
        obj.oy = obj.ny;

        obj.nx = nx;
        obj.ny = ny;

        const rate = 1;
        this.cam.azimuth = this.cam.azimuth + dx * rate;
        this.cam.incline = clamp(this.cam.incline - dy * rate, -89, 89);
    }
}
