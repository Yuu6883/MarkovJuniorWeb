import seedrandom from "seedrandom";

import { Helper } from "./helpers/helper";
import { Loader } from "./helpers/loader";
import { VoxHelper } from "./helpers/vox";
import { Interpreter } from "./interpreter";

import ModelsXML from "../static/models.xml";
import PaletteXML from "../static/resources/palette.xml";

import { Optimization } from "./wasm/optimization";

import ObsModuleURL from "./bin/rule.wasm";
import { WasmModule } from "./wasm";

import * as fsp from "fs/promises";

Optimization.loadPromise = (async () => {
    {
        const buf = await fsp.readFile(ObsModuleURL);
        Optimization.module = await WasmModule.load(buf);
    }
})().catch((_) => (Optimization.module = null));

export type ProgramOutput = { name: string; buffer: ArrayBuffer };

export interface ProgramParams {
    steps?: number;
}

export class Program {
    public static instance: Model = null;

    public static models: Map<string, Element> = new Map();

    public static palette: Map<string, Uint8ClampedArray> = new Map();

    public static meta = seedrandom();

    public static loadPalette() {
        const ep = Loader.xmlParse(PaletteXML);
        const ecolors = [...Helper.childrenByTag(ep, "color")];
        this.palette = new Map(
            ecolors.map((e) => [
                e.getAttribute("symbol").charAt(0),
                Helper.hex2rgba(e.getAttribute("value")),
            ])
        );
    }

    public static listModels() {
        const doc = Loader.xmlParse(ModelsXML);
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

    public static load(name: string) {
        if (this.instance) {
            this.instance.stop();
            this.instance = null;
        }

        const model = new Model(name);
        if (!model.load()) return null;
        this.instance = model;
        return model;
    }
}

export class Model {
    public readonly key: string;
    public readonly name: string;

    private readonly modelDescriptor: Element;
    public modelXML: string;
    private modelDoc: Element;

    private ip: Interpreter;

    private _curr: Generator<[Uint8Array, string, number, number, number]> =
        null;

    private _seed: number = null;
    private _speed = 0;
    private _delay = 0;
    private _paused = false;

    private _loadPromise: Promise<boolean>;
    private _timer = 0;
    private _steps = -1;

    private lastLoop = 0;
    public loading = false;
    public output: ProgramOutput = null;

    public readonly DIM = new Int32Array([-1, -1, -1]);
    public palette: typeof Program.palette;

    constructor(key: string) {
        this.key = key;

        if (!Program.palette) {
            console.error("Load palette first before running any model");
        }

        const emodel = (this.modelDescriptor = Program.models.get(
            key?.toUpperCase()
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

        this._loadPromise = (async () => {
            await Optimization.loadPromise;

            const path = `models/${name}.xml`;
            const result = await Loader.xml(path);

            if (!result) {
                console.error(`Failed to load ${path}`);
                return false;
            }

            this.modelXML = result.text;
            this.modelDoc = result.elem;

            const seedString = emodel.getAttribute("seeds");

            this.palette = new Map(Program.palette.entries());
            for (const ec of Helper.childrenByTag(emodel, "color")) {
                this.palette.set(
                    ec.getAttribute("symbol").charAt(0),
                    Helper.hex2rgba(ec.getAttribute("value"))
                );
            }

            this.ip = await Interpreter.load(
                this.modelDoc,
                this.DIM[0],
                this.DIM[1],
                this.DIM[2]
            );

            return true;
        })();
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

    public get seed() {
        return this._seed;
    }

    public start(params?: ProgramParams) {
        if (this._curr) this._curr.throw(new Error("Interrupt"));
        this._curr = null;
        this.output = null;

        if (this.loading) return Promise.resolve(false);
        this.loading = true;

        return this._loadPromise.then(async (loaded) => {
            if (!loaded) return false;

            this._steps = params?.steps || -1;

            this.loading = false;
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
        this._paused = true;
        this.loop(true);
    }

    public randomize() {
        this._seed = Program.meta.int32();
    }

    private scaleTime(t: number) {
        if (this._speed > 0) {
            return t * this._speed;
        } else return t;
    }

    private loop(once = false, render = true) {
        if (!once && this._paused) return;

        const start = performance.now();

        if (!this._curr) this._curr = this.ip?.run(this._seed, this._steps);
        if (!this._curr) return;

        let result = this._curr.next();
        let dt = this.lastLoop ? start - this.lastLoop : 0;
        this.ip.time += this.scaleTime(dt);

        if (!once && this._speed > 0 && dt <= 20) {
            for (let i = 0; i < this._speed; i++) {
                result = this._curr.next();

                dt = performance.now() - start;
                this.ip.time += this.scaleTime(dt);
                // Cap per frame execution to 20ms/50fps
                if (dt > 20) break;
            }
        }

        const end = performance.now();
        this._timer += end - start;
        this.lastLoop = end;

        if (result.done) {
            this._curr = null;

            const [state, chars, FX, FY, FZ] = this.ip.state();

            this.ip.onRender();
            // TODO: pass state

            if (FZ > 1) {
                const colors = chars.split("").map((c) => this.palette.get(c));

                this.output = {
                    name: `${this.name}_${this._seed}.vox`,
                    buffer: VoxHelper.serialize(state, FX, FY, FZ, colors),
                };
            }

            console.log(`Time: ${this._timer.toFixed(2)}ms`);
        } else {
            if (!once) {
                this._delay
                    ? setTimeout(() => this.loop(), this._delay)
                    : setImmediate(() => this.loop());
            }

            if (render) {
                const [state, chars, FX, FY, FZ] = result.value;

                this.ip.onRender();
                // TODO: pass state
            }
        }
    }

    public async benchmark(runs = 10, rng_seed = true) {
        const timings = new Float64Array(runs);

        const ip = await Interpreter.load(
            this.modelDoc,
            this.DIM[0],
            this.DIM[1],
            this.DIM[2]
        );

        for (let i = 0; i < runs; i++) {
            const seed = rng_seed ? Program.meta.int32() : this._seed;
            const iter = ip?.run(seed, this._steps);

            const start = performance.now();
            let result = iter.next();
            while (!result.done) result = iter.next();
            const end = performance.now();

            timings[i] = end - start;
            console.log(`run[${i}] finished: ${(end - start).toFixed(2)}ms`);

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (runs > 1) {
            let sum = 0;
            for (let i = 0; i < runs; i++) sum += timings[i];
            console.log(`average runtime: ${(sum / runs).toFixed(6)}ms`);
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
        // point of this is to call RuleNode.searching.throw
        // which breaks the scope that keeps the webassembly instance "alive" (not gc'd)
        this.ip?.root.reset();
    }

    // Not needed for now
    // public event(name: string, key: string) {
    //     const curr = this.ip?.listener;
    //     if (!curr) return;

    //     curr.event(name, key);
    // }
}
