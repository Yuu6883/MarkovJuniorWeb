import seedrandom from "seedrandom";
import {
    BitmapRenderer,
    IsometricRenderer,
    Renderer,
} from "./helpers/graphics";

import { Helper } from "./helpers/helper";
import { Loader } from "./helpers/loader";
import { VoxHelper } from "./helpers/vox";
import { Interpreter } from "./interpreter";

const frame = (n = 0) =>
    new Promise((resolve) =>
        n ? setTimeout(resolve, n) : requestAnimationFrame(resolve)
    );

export interface ProgramParams {
    steps?: number;
    speed?: number;
}

export class Program {
    private static meta = seedrandom();
    static models: Map<string, Element> = new Map();
    static palette: Map<string, Uint8ClampedArray>;

    public static async loadPalette() {
        const ep = await Loader.xml("resources/palette.xml");
        const ecolors = [...Helper.childrenByTag(ep, "color")];
        this.palette = new Map(
            ecolors.map((e) => [
                e.getAttribute("symbol").charAt(0),
                Helper.hex2rgba(e.getAttribute("value")),
            ])
        );
    }

    public static async listModels() {
        const doc = await Loader.xml("models.xml");
        this.models.clear();

        for (const emodel of Helper.childrenByTag(doc, "model")) {
            const name = emodel.getAttribute("name")?.toUpperCase() || "MODEL";

            const tryInsert = (suffix: number = null) => {
                const n = suffix === null ? name : `${name}_${suffix}`;
                if (!this.models.has(n)) {
                    this.models.set(n, emodel);
                } else tryInsert(suffix ? suffix + 1 : 1);
            };

            tryInsert();
        }
    }

    public static init(model: string, canvas: HTMLCanvasElement) {
        if (!Program.palette) {
            console.error("Load palette first before running any model");
            return null;
        }

        const emodel = this.models.get(model?.toUpperCase());
        if (!canvas || !emodel) return null;

        const name = emodel.getAttribute("name");
        const size = parseInt(emodel.getAttribute("size")) || -1;
        const dimension = parseInt(emodel.getAttribute("d")) || 2;

        const MX = parseInt(emodel.getAttribute("length")) || size;
        const MY = parseInt(emodel.getAttribute("width")) || size;
        const MZ =
            parseInt(emodel.getAttribute("height")) ||
            (dimension === 2 ? 1 : size);

        const renderer: Renderer =
            MZ === 1
                ? new BitmapRenderer(canvas)
                : new IsometricRenderer(canvas);

        renderer.clear();

        let stop = false;

        let resolveAbort: Function;
        let abortPromise: Promise<boolean>;

        const abort = () => {
            stop = true;

            if (!abortPromise)
                abortPromise = new Promise((r) => (resolveAbort = r));
            return abortPromise;
        };

        let speed = 1;
        let delay = 0;

        const setSpeed = (n: number) => {
            if (n <= 0) {
                speed = 0;
                delay = Math.abs(n);
            } else {
                speed = ~~n;
                delay = 0;
            }
        };

        let modelCache: Element;

        const start = async (params: ProgramParams) => {
            stop = false;
            setSpeed(params.speed);

            const overwriteSteps = params.steps || 0;

            const path = `models/${name}.xml`;
            const mdoc = modelCache || (await Loader.xml(path));
            if (!mdoc) {
                console.error(`Failed to load ${path}`);
                return null;
            }
            modelCache = mdoc;

            const interpreter = await Interpreter.load(mdoc, MX, MY, MZ);
            if (!interpreter) {
                console.error(`Interpreter.load failed ${path}`);
                return null;
            }

            console.log(`Running model: ${name}`);

            const pixelsize = parseInt(emodel.getAttribute("pixelsize")) || 4;
            const seedString = emodel.getAttribute("seeds");
            const seeds = seedString?.split(" ").map((s) => parseInt(s));

            // const gif = emodel.getAttribute("gif") === "True";
            const iso = emodel.getAttribute("iso") === "True";
            const steps =
                overwriteSteps ||
                parseInt(emodel.getAttribute("steps")) ||
                50000;

            const customPalette = new Map(Program.palette.entries());
            for (const ec of Helper.childrenByTag(emodel, "color")) {
                customPalette.set(
                    ec.getAttribute("symbol").charAt(0),
                    Helper.hex2rgba(ec.getAttribute("value"))
                );
            }

            const [chars, GX, GY, GZ] = interpreter.info();

            const colors = chars.split("").map((c) => customPalette.get(c));
            renderer.palette(colors);
            renderer.update(GX, GY, GZ);

            let rendered = 0;
            let output: { name: string; buffer: ArrayBuffer } = null;

            const start = performance.now();
            const seed = seeds?.[0] || this.meta.int32();

            for (const [result, _, FX, FY, FZ] of interpreter.run(
                seed,
                steps,
                true
            )) {
                if (stop) {
                    resolveAbort(true);
                    return null;
                }
                if (rendered++ % speed) continue;

                if (FZ === 1 || iso) {
                    renderer.update(FX, FY, FZ);
                    renderer.render(result);
                } else {
                    // TODO: render voxels
                }

                await frame(delay);
            }

            const [result, _, FX, FY, FZ] = interpreter.final();
            if (FZ === 1) {
                renderer.update(FX, FY, FZ);
                renderer.render(result);
            } else {
                output = {
                    name: `${name}_${seed}.vox`,
                    buffer: VoxHelper.serialize(result, FX, FY, FZ, colors),
                };
            }

            const end = performance.now();

            console.log(
                `DONE (steps = ${rendered}, time = ${(end - start).toFixed(
                    2
                )}ms)`
            );

            if (resolveAbort) resolveAbort(false);
            return { time: end - start, output };
        };

        return { name, dimension, MX, MY, MZ, abort, start, setSpeed };
    }
}
