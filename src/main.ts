import seedrandom from "seedrandom";
import { Graphics } from "./helpers/graphics";
import { Helper } from "./helpers/helper";
import { Loader } from "./helpers/loader";
import { Interpreter } from "./interpreter";

const frame = (n = 0) =>
    new Promise((resolve) =>
        n ? setTimeout(resolve, n) : requestAnimationFrame(resolve)
    );

export interface ProgramParams {
    steps?: number;
}

export class Program {
    private static meta = seedrandom();
    static models: Map<string, Element> = new Map();
    static palette: Map<string, Uint8ClampedArray>;

    public static async loadPalette() {
        const ep = await Loader.xml("resources/palette.xml");
        const ecolors = Helper.collectionToArr(ep.querySelectorAll("color"));
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

        for (const emodel of Helper.collectionIter(
            doc.querySelectorAll("model")
        )) {
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

    public static init(model: string) {
        if (!Program.palette) {
            console.error("Load palette first before running any model");
            return null;
        }

        const emodel = this.models.get(model?.toUpperCase());
        if (!emodel) return null;
        Graphics.clear();

        const name = emodel.getAttribute("name");
        const size = parseInt(emodel.getAttribute("size")) || -1;
        const dimension = parseInt(emodel.getAttribute("d")) || 2;

        const MX = parseInt(emodel.getAttribute("length")) || size;
        const MY = parseInt(emodel.getAttribute("width")) || size;
        const MZ =
            parseInt(emodel.getAttribute("height")) ||
            (dimension === 2 ? 1 : size);

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

        const start = async (params: ProgramParams) => {
            stop = false;

            const overwriteSteps = params.steps || 0;

            const path = `models/${name}.xml`;
            const mdoc = await Loader.xml(path);
            if (!mdoc) {
                console.error(`Failed to load ${path}`);
                return null;
            } else console.log("Loading model...");

            const interpreter = await Interpreter.load(mdoc, MX, MY, MZ);
            if (!interpreter) {
                console.error(`Interpreter.load failed ${path}`);
                return null;
            } else console.log(`Model loaded: ${name}`);

            const pixelsize = parseInt(emodel.getAttribute("pixelsize")) || 4;
            const seedString = emodel.getAttribute("seeds");
            const seeds = seedString?.split(" ").map((s) => parseInt(s));

            // const gif = emodel.getAttribute("gif") === "True";
            const iso = emodel.getAttribute("iso") === "True";
            const steps =
                overwriteSteps ||
                parseInt(emodel.getAttribute("steps")) ||
                50000;

            let rendered = 0;

            const start = performance.now();
            const seed = seeds?.[0] || this.meta.int32();

            for (const [result, legend, FX, FY, FZ] of interpreter.run(
                seed,
                steps,
                true
            )) {
                if (stop) {
                    resolveAbort(true);
                    return null;
                }
                if (rendered++ % speed) continue;

                const colors = legend
                    .split("")
                    .map((c) => Program.palette.get(c));
                if (FZ === 1 || iso) {
                    await Graphics.renderBitmap(
                        result,
                        FX,
                        FY,
                        colors,
                        pixelsize
                        // interpreter.root.nodes[0] as RuleNode
                    );
                } else {
                    // TODO: save VOX / render
                }

                await frame(delay);
            }

            const [result, legend, FX, FY, FZ] = interpreter.final();
            const colors = legend.split("").map((c) => Program.palette.get(c));
            if (FZ === 1) {
                await Graphics.renderBitmap(
                    result,
                    FX,
                    FY,
                    colors,
                    pixelsize
                    // interpreter.root.nodes[0] as RuleNode
                );
            } else {
            }

            const end = performance.now();

            console.log(
                `DONE (steps = ${rendered}, time = ${(end - start).toFixed(
                    2
                )}ms)`
            );

            if (resolveAbort) resolveAbort(false);
            return { time: end - start };
        };

        return { name, dimension, MX, MY, MZ, abort, start, setSpeed };
    }
}
