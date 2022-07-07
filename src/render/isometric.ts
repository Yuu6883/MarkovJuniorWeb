import { Renderer } from ".";
import { BoolArray, BoolArray2D } from "../helpers/datastructures";

export class IsometricRenderer extends Renderer {
    public static readonly BLOCK_SIZE = 6;
    private static _canvas = document.createElement("canvas");
    private static _ctx = IsometricRenderer._canvas.getContext("2d");

    public override get canvas(): HTMLCanvasElement {
        return IsometricRenderer._canvas;
    }

    private get ctx() {
        return IsometricRenderer._ctx;
    }

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

    private MX: number;
    private MY: number;
    private MZ: number;

    private visible: BoolArray;
    private hash: BoolArray2D;

    private sprite: VoxelSprite;
    private img: ImageData;

    constructor() {
        super();
        this.sprite = new VoxelSprite(IsometricRenderer.BLOCK_SIZE);
        this.canvas.style.imageRendering = "auto";
        this.canvas.style.objectFit = "contain";
    }

    override update(MX: number, MY: number, MZ: number) {
        if (this.MX === MX && this.MY === MY && this.MZ === MZ) return;

        this.MX = MX;
        this.MY = MY;
        this.MZ = MZ;
        this.visible = new BoolArray(MX * MY * MZ);
        this.hash = new BoolArray2D(MX + MY + 2 * MZ - 3, MX + MY - 1);

        const FITWIDTH = (MX + MY) * this.sprite.size,
            FITHEIGHT = ~~(((MX + MY) / 2 + MZ) * this.sprite.size);

        const W = FITWIDTH + 2 * this.sprite.size;
        const H = FITHEIGHT + 2 * this.sprite.size;

        this.img = new ImageData(W, H);
    }

    override _render(state: Uint8Array) {
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

        const BLOCK_SIZE = this.sprite.size;
        const FITWIDTH = (MX + MY) * BLOCK_SIZE,
            FITHEIGHT = ~~(((MX + MY) / 2 + MZ) * BLOCK_SIZE);

        const W = FITWIDTH + 2 * BLOCK_SIZE;
        const H = FITHEIGHT + 2 * BLOCK_SIZE;

        this.canvas.width = W;
        this.canvas.height = H;

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

                    sprite.draw(data, r, g, b, ~~x, ~~y, W, edges);
                }

            ctx.putImageData(img, 0, 0);
        };
        // So it shows up in profiler
        renderState();
    }

    override clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    override dispose() {}
}

// Brightness on 3 sides of the cube
const C1 = 215;
const C2 = 143;
const C3 = 71;

const transparent = 0xff;
const black = 0;

declare type FragFunc = (x: number, y: number) => number;

const frag_funcs = new Array<string>(8);
frag_funcs[0] = "x == 1 && y <= 0 ? C1 : expr";
frag_funcs[1] = "x == 0 && y <= 0 ? C1 : expr";
frag_funcs[2] = "x == 1 - s && 2 * y < s && 2 * y >= -s ? black : expr";
frag_funcs[3] = "x <= 0 && y == ~~(x / 2) + s - 1 ? black : expr";
frag_funcs[4] = "x == s && 2 * y < s && 2 * y >= -s ? black : expr";
frag_funcs[5] = "x > 0 && y == -~~((x + 1) / 2) + s ? black : expr";
frag_funcs[6] = "x > 0 && y == ~~((x + 1) / 2) - s ? black : expr";
frag_funcs[7] = "x <= 0 && y == -~~(x / 2) - s + 1 ? black : expr";

class VoxelSprite {
    public readonly size: number;
    public readonly width: number;
    public readonly height: number;

    private readonly edge_func_table: FragFunc[];

    constructor(size: number) {
        this.size = size;
        this.width = size * 2;
        this.height = size * 2 - 1;

        this.edge_func_table = Array.from({ length: 256 }, (_, index) => {
            const funcs: string[] = [];
            for (let i = 0; i < 8; i++) {
                if ((1 << i) & index) {
                    funcs.push(frag_funcs[i]);
                }
            }
            const nested = funcs.reduce(
                (prev, curr) => prev.replaceAll("expr", `(${curr})`),
                `(x, y) => {
                    const c = expr;
                    if (c !== transparent) return c;

                    if (
                        2 * y - x >= 2 * s ||
                        2 * y + x > 2 * s ||
                        2 * y - x < -2 * s ||
                        2 * y + x <= -2 * s
                    ) {
                        return transparent;
                    } else if (x > 0 && 2 * y < x) {
                        return C3;
                    } else if (x <= 0 && 2 * y <= -x) {
                        return C2;
                    } else {
                        return C1;
                    }
                }`
            );

            const cleaned = nested
                .replaceAll(/\bs\b/g, this.size.toString())
                .replaceAll("C1", C1.toString())
                .replaceAll("C2", C2.toString())
                .replaceAll("C3", C3.toString())
                .replaceAll("black", black.toString())
                .replaceAll("expr", "transparent")
                .replaceAll("transparent", transparent.toString());
            return eval(cleaned);
        });
    }

    draw(
        dist: Uint8ClampedArray,
        r: number,
        g: number,
        b: number,
        x: number,
        y: number,
        w: number,
        edges: number
    ) {
        const { width, height, edge_func_table, size } = this;
        const func = edge_func_table[edges];

        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const grayscale = func(dx - size + 1, size - dy - 1);
                if (grayscale === transparent) continue;

                const d_offset = ((y + dy) * w + (x + dx)) << 2;
                dist[d_offset + 0] = (r * grayscale) / 256;
                dist[d_offset + 1] = (g * grayscale) / 256;
                dist[d_offset + 2] = (b * grayscale) / 256;
                dist[d_offset + 3] = 255;
            }
        }
    }
}
