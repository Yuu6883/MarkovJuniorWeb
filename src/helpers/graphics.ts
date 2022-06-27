import { BoolArray, BoolArray2D } from "./datastructures";

export abstract class Renderer {
    private _chars: string;
    private _palette: Map<string, Uint8ClampedArray>;
    protected colors: Uint8Array;

    set characters(chars: string) {
        if (this._chars !== chars) {
            this._chars = chars;

            const colorArr = chars.split("").map((c) => this._palette.get(c));
            this.colors = new Uint8Array(colorArr.length * 4);
            for (let i = 0; i < colorArr.length; i++) {
                this.colors.set(colorArr[i], i * 4);
            }
        }
    }

    set palette(colors: Map<string, Uint8ClampedArray>) {
        this._palette = new Map([...colors.entries()]);
    }

    abstract update(MX: number, MY: number, MZ: number);
    abstract render(state: Uint8Array);
    abstract clear();
}

export class BitmapRenderer extends Renderer {
    private MX: number;
    private MY: number;
    private img: ImageData;

    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        super();
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
    }

    override update(MX: number, MY: number, _: number) {
        if (this.MX === MX && this.MY === MY) return;

        this.MX = MX;
        this.MY = MY;
        this.img = new ImageData(MX, MY);
    }

    // TODO: use wasm to speed up? or just color it on GPU w shaders
    override render(state: Uint8Array) {
        const { MX, MY, img, colors, canvas, ctx } = this;
        if (!canvas || !ctx || !colors || !img) return;

        const { data } = img;

        const total = MX * MY;
        for (let offset = 0; offset < total; offset++) {
            const c = state[offset] << 2;
            const o = offset << 2;

            // imagine simd in js ):
            data[o + 0] = colors[c + 0];
            data[o + 1] = colors[c + 1];
            data[o + 2] = colors[c + 2];
            data[o + 3] = colors[c + 3];
        }

        canvas.width = MX;
        canvas.height = MY;

        canvas.style.width = `${MX}px`;
        canvas.style.height = `${MY}px`;
        ctx.putImageData(img, 0, 0);
    }

    override clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

const BLOCK_SIZE = 6;

export class IsometricRenderer extends Renderer {
    protected static pool = new Uint8Array(10 * 1024 * 1024); // 10mb mem
    private static pool_ptr = 0;

    protected static voxel(value: number, x: number, y: number, z: number) {
        const pool = this.pool;
        const ptr = this.pool_ptr;

        this.pool_ptr += 5;

        pool[ptr + 0] = value;
        pool[ptr + 1] = x;
        pool[ptr + 2] = y;
        pool[ptr + 3] = z;

        return ptr;
    }

    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;

    private MX: number;
    private MY: number;
    private MZ: number;

    private visible: BoolArray;
    private hash: BoolArray2D;

    private sprite: VoxelSprite;
    private img: ImageData;

    constructor(canvas: HTMLCanvasElement) {
        super();
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.sprite = new VoxelSprite(BLOCK_SIZE);
    }

    override update(MX: number, MY: number, MZ: number) {
        if (this.MX === MX && this.MY === MY && this.MZ === MZ) return;

        this.MX = MX;
        this.MY = MY;
        this.MZ = MZ;
        this.visible = new BoolArray(MX * MY * MZ);
        this.hash = new BoolArray2D(MX + MY + 2 * MZ - 3, MX + MY - 1);

        const FITWIDTH = (MX + MY) * BLOCK_SIZE,
            FITHEIGHT = ~~(((MX + MY) / 2 + MZ) * BLOCK_SIZE);

        const W = FITWIDTH + 2 * BLOCK_SIZE;
        const H = FITHEIGHT + 2 * BLOCK_SIZE;

        this.img = new ImageData(W, H);
    }

    override render(state: Uint8Array) {
        const { MX, MY, MZ, visible, hash, ctx, sprite, colors, img } = this;

        if (!ctx || !sprite || !colors || !img) return;

        visible.clear();
        hash.clear();

        const voxels: number[][] = Array.from(
            { length: MX + MY + MZ - 2 },
            (_) => []
        );
        const visibleVoxels: number[][] = Array.from(
            { length: MX + MY + MZ - 2 },
            (_) => []
        );

        // Reset memory pool state
        IsometricRenderer.pool.fill(0);
        IsometricRenderer.pool_ptr = 0;

        const buildState = () => {
            for (let z = 0; z < MZ; z++)
                for (let y = 0; y < MY; y++)
                    for (let x = 0; x < MX; x++) {
                        const i = x + y * MX + z * MX * MY;
                        const value = state[i];
                        visible.set(i, value !== 0);
                        if (value !== 0)
                            voxels[x + y + z].push(
                                IsometricRenderer.voxel(value, x, y, z)
                            );
                    }

            const pool = IsometricRenderer.pool;

            for (let i = voxels.length - 1; i >= 0; i--) {
                const voxelsi = voxels[i];
                for (let j = 0; j < voxelsi.length; j++) {
                    const voxel_ptr = voxelsi[j];

                    const sx = pool[voxel_ptr + 1];
                    const sy = pool[voxel_ptr + 2];
                    const sz = pool[voxel_ptr + 3];

                    let u = sx - sy + MY - 1,
                        v = sx + sy - 2 * sz + 2 * MZ - 2;
                    if (!hash.get(v, u)) {
                        const X =
                            sx === 0 ||
                            !visible.get(sx - 1 + sy * MX + sz * MX * MY);
                        const Y =
                            sy === 0 ||
                            !visible.get(sx + (sy - 1) * MX + sz * MX * MY);
                        const Z =
                            sz === 0 ||
                            !visible.get(sx + sy * MX + (sz - 1) * MX * MY);

                        // prettier-ignore
                        pool[voxel_ptr + 4] =
                            (Number(sy === MY - 1 || !visible.get(sx + (sy + 1) * MX + sz * MX * MY)) << 0) |
                            (Number(sx === MX - 1 || !visible.get(sx + 1 + sy * MX + sz * MX * MY)) << 1) |
                            (Number(X || (sy != MY - 1 && visible.get(sx - 1 + (sy + 1) * MX + sz * MX * MY))) << 2) |
                            (Number(X || (sz != MZ - 1 && visible.get(sx - 1 + sy * MX + (sz + 1) * MX * MY))) << 3) |
                            (Number(Y || (sx != MX - 1 && visible.get(sx + 1 + (sy - 1) * MX + sz * MX * MY))) << 4) |
                            (Number(Y || (sz != MZ - 1 && visible.get(sx + (sy - 1) * MX + (sz + 1) * MX * MY))) << 5) |
                            (Number(Z || (sx != MX - 1 && visible.get(sx + 1 + sy * MX + (sz - 1) * MX * MY))) << 6) |
                            (Number(Z || (sy != MY - 1 && visible.get(sx + (sy + 1) * MX + (sz - 1) * MX * MY))) << 7);

                        visibleVoxels[i].push(voxel_ptr);
                        hash.set(v, u, true);
                    }
                }
            }
        };
        // So it shows up in profiler
        buildState();

        const FITWIDTH = (MX + MY) * BLOCK_SIZE,
            FITHEIGHT = ~~(((MX + MY) / 2 + MZ) * BLOCK_SIZE);

        const W = FITWIDTH + 2 * BLOCK_SIZE;
        const H = FITHEIGHT + 2 * BLOCK_SIZE;

        this.canvas.width = W;
        this.canvas.height = H;

        const SW = sprite.width;
        const SH = sprite.height;

        const renderState = () => {
            const { data } = img;
            const pool = IsometricRenderer.pool;

            data.fill(0);
            for (const row of visibleVoxels)
                for (const ptr of row) {
                    const c = pool[ptr + 0];
                    const sx = pool[ptr + 1];
                    const sy = pool[ptr + 2];
                    const sz = pool[ptr + 3];
                    const edges = pool[ptr + 4];

                    const u = BLOCK_SIZE * (sx - sy);
                    const v = ~~(
                        (BLOCK_SIZE * (sx + sy)) / 2 -
                        BLOCK_SIZE * sz
                    );
                    const x = W / 2 + u - BLOCK_SIZE;
                    const y = (H - FITHEIGHT) / 2 + (MZ - 1) * BLOCK_SIZE + v;

                    const co = c << 2;
                    const r = colors[co + 0];
                    const g = colors[co + 1];
                    const b = colors[co + 2];

                    sprite.draw(sprite.cube, data, r, g, b, ~~x, ~~y, W);

                    for (let j = 0; j < 8; j++) {
                        if (edges & (1 << j)) {
                            sprite.draw(
                                sprite.edges.subarray(
                                    SW * SH * j,
                                    SW * SH * (j + 1)
                                ),
                                data,
                                r,
                                g,
                                b,
                                ~~x,
                                ~~y,
                                W
                            );
                        }
                    }
                }

            ctx.putImageData(img, 0, 0);
        };
        // So it shows up in profiler
        renderState();
    }

    override clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Brightness on 3 sides of the cube
const C1 = 215;
const C2 = 143;
const C3 = 71;

const transparent = 0xff;
const black = 0;

class VoxelSprite {
    public readonly cube: Uint8Array;
    public readonly edges: Uint8Array;

    public readonly width: number;
    public readonly height: number;

    constructor(size: number) {
        const w = (this.width = size * 2);
        const h = (this.height = size * 2 - 1);

        const texture = (
            out: Uint8Array,
            f: (x: number, y: number) => number
        ) => {
            for (let j = 0; j < h; j++)
                for (let i = 0; i < w; i++)
                    out[i + j * w] = f(i - size + 1, size - j - 1);
            return out;
        };

        this.cube = texture(new Uint8Array(w * h), (x, y) => {
            if (
                2 * y - x >= 2 * size ||
                2 * y + x > 2 * size ||
                2 * y - x < -2 * size ||
                2 * y + x <= -2 * size
            )
                return transparent;
            else if (x > 0 && 2 * y < x) return C3;
            else if (x <= 0 && 2 * y <= -x) return C2;
            else return C1;
        });

        const e = (this.edges = new Uint8Array(w * h * 8));

        texture(e.subarray(w * h * 0, w * h * (0 + 1)), (x, y) =>
            x == 1 && y <= 0 ? C1 : transparent
        );
        texture(e.subarray(w * h * 1, w * h * (1 + 1)), (x, y) =>
            x == 0 && y <= 0 ? C1 : transparent
        );
        texture(e.subarray(w * h * 2, w * h * (2 + 1)), (x, y) =>
            x == 1 - size && 2 * y < size && 2 * y >= -size
                ? black
                : transparent
        );
        texture(e.subarray(w * h * 3, w * h * (3 + 1)), (x, y) =>
            x <= 0 && y == ~~(x / 2) + size - 1 ? black : transparent
        );
        texture(e.subarray(w * h * 4, w * h * (4 + 1)), (x, y) =>
            x == size && 2 * y < size && 2 * y >= -size ? black : transparent
        );
        texture(e.subarray(w * h * 5, w * h * (5 + 1)), (x, y) =>
            x > 0 && y == -~~((x + 1) / 2) + size ? black : transparent
        );
        texture(e.subarray(w * h * 6, w * h * (6 + 1)), (x, y) =>
            x > 0 && y == ~~((x + 1) / 2) - size ? black : transparent
        );
        texture(e.subarray(w * h * 7, w * h * (7 + 1)), (x, y) =>
            x <= 0 && y == -~~(x / 2) - size + 1 ? black : transparent
        );
    }

    draw(
        source: Uint8Array,
        dist: Uint8ClampedArray,
        r: number,
        g: number,
        b: number,
        x: number,
        y: number,
        w: number
    ) {
        const { width, height } = this;

        for (let dy = 0; dy < height; dy++)
            for (let dx = 0; dx < width; dx++) {
                const s_offset = dx + dy * width;

                const d_offset = ((y + dy) * w + (x + dx)) << 2;

                const grayscale = source[s_offset];

                if (grayscale === 0xff) continue;

                dist[d_offset + 0] = (r * grayscale) / 256;
                dist[d_offset + 1] = (g * grayscale) / 256;
                dist[d_offset + 2] = (b * grayscale) / 256;
                dist[d_offset + 3] = 255;
            }
    }
}
