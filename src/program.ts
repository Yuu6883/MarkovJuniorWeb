import seedrandom from "seedrandom";
import { action, computed, makeObservable, observable } from "mobx";

import {
    BitmapRenderer,
    IsometricRenderer,
    Renderer,
} from "./helpers/graphics";

import { Helper } from "./helpers/helper";
import { Loader } from "./helpers/loader";
import { VoxHelper } from "./helpers/vox";
import { Interpreter } from "./interpreter";

export type ProgramOutput = { name: string; buffer: ArrayBuffer };

export interface ProgramParams {
    steps?: number;
}

export class Program {
    private static meta = seedrandom();
    public static models: Map<string, Element> = new Map();
    private static palette: Map<string, Uint8ClampedArray>;

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

    public readonly name: string;
    public readonly renderer: Renderer;
    private readonly modelDescriptor: Element;
    private modelDoc: Element;

    private ip: Interpreter;
    private _curr: Generator<[Uint8Array, string, number, number, number]>;
    private _seed: number;
    private _speed = 0;
    private _delay = 0;

    private _paused = false;
    private _loadPromise: Promise<boolean>;
    private _timer = 0;
    private _steps = -1;
    private _rendered = 0;

    public output: ProgramOutput = null;

    public readonly DIM = new Int32Array([-1, -1, -1]);

    constructor(model: string) {
        if (!Program.palette) {
            console.error("Load palette first before running any model");
        }

        const emodel = (this.modelDescriptor = Program.models.get(
            model?.toUpperCase()
        ));
        if (!this.modelDescriptor) return;

        const name = (this.name = emodel.getAttribute("name"));
        const size = parseInt(emodel.getAttribute("size")) || -1;
        const dimension = parseInt(emodel.getAttribute("d")) || 2;

        this.DIM[0] = parseInt(emodel.getAttribute("length")) || size;
        this.DIM[1] = parseInt(emodel.getAttribute("width")) || size;
        this.DIM[2] =
            parseInt(emodel.getAttribute("height")) ||
            (dimension === 2 ? 1 : size);

        this.renderer =
            this.DIM[2] === 1 ? new BitmapRenderer() : new IsometricRenderer();
        this.renderer.clear();

        this._loadPromise = (async () => {
            const path = `models/${name}.xml`;
            const mdoc = (this.modelDoc = await Loader.xml(path));

            if (!mdoc) {
                console.error(`Failed to load ${path}`);
                return false;
            }

            const seedString = emodel.getAttribute("seeds");
            const seeds = seedString?.split(" ").map((s) => parseInt(s));

            const customPalette = new Map(Program.palette.entries());
            for (const ec of Helper.childrenByTag(emodel, "color")) {
                customPalette.set(
                    ec.getAttribute("symbol").charAt(0),
                    Helper.hex2rgba(ec.getAttribute("value"))
                );
            }

            this.renderer.palette = customPalette;
            this._seed = seeds?.[0] || Program.meta.int32();

            return true;
        })();

        document
            .getElementById("canvas-container")
            .appendChild(this.renderer.canvas);
        this.renderer.clear();

        makeObservable(this, {
            output: observable,
            MX: computed,
            MY: computed,
            MZ: computed,
            paused: computed,
            running: computed,
            speed: computed,
            pause: action,
            resume: action,
            stop: action,
            load: action,
            start: action,
        });
    }

    public load() {
        return this._loadPromise;
    }

    public get paused() {
        return this._paused;
    }

    public set speed(n: number) {
        if (n <= 0) {
            this._speed = 0;
            this._delay = Math.abs(n);
        } else {
            this._speed = ~~n;
            this._delay = 0;
        }
    }

    public get speed() {
        return this._delay ? -this._delay : this._speed;
    }

    public get running() {
        return !!this._curr;
    }

    public start(params?: ProgramParams) {
        this.ip = null;
        this._curr = null;
        this.output = null;

        return this._loadPromise.then(async (loaded) => {
            if (!loaded) return false;

            this._steps = params?.steps || -1;
            this.ip = await Interpreter.load(
                this.modelDoc,
                this.DIM[0],
                this.DIM[1],
                this.DIM[2]
            );

            this._timer = 0;
            this._paused = false;
            this.loop();

            return true;
        });
    }

    public pause() {
        this._paused = true;
    }

    public resume() {
        this._paused = false;
        this.loop();
    }

    public step() {
        this.loop(true);
    }

    private loop(once = false, render = true) {
        if (!once && this._paused) return;

        const start = performance.now();
        if (!this._curr) this._curr = this.ip?.run(this._seed, this._steps);
        if (!this._curr) return;

        let result = this._curr.next();

        if (this._speed > 0) {
            for (let i = 0; i < this._speed; i++) {
                result = this._curr.next();

                // Cap per frame execution to 20ms/50fps
                if (performance.now() - start > 20) break;
            }
        }

        const end = performance.now();
        this._timer += end - start;

        if (result.done) {
            this._curr = null;

            const [state, chars, FX, FY, FZ] = this.ip.final();

            this.renderer.characters = chars;
            this.renderer.update(FX, FY, FZ);
            this.renderer.render(state);

            if (FZ > 1) {
                const palette = this.renderer.palette;
                const colors = chars.split("").map((c) => palette.get(c));

                this.output = {
                    name: `${this.name}_${this._seed}.vox`,
                    buffer: VoxHelper.serialize(state, FX, FY, FZ, colors),
                };
            }

            console.log(`Time: ${this._timer.toFixed(2)}ms`);
        } else {
            if (!once)
                this._delay
                    ? setTimeout(() => this.loop(), this._delay)
                    : requestAnimationFrame(() => this.loop());

            if (render) {
                const [state, chars, FX, FY, FZ] = result.value;

                this.renderer.characters = chars;
                this.renderer.update(FX, FY, FZ);
                this.renderer.render(state);
            }
        }
    }

    public get MX() {
        return this.DIM[0];
    }

    public get MY() {
        return this.DIM[1];
    }

    public get MZ() {
        return this.DIM[2];
    }

    public stop() {
        this.pause();
        this.renderer.canvas.remove();
    }
}
