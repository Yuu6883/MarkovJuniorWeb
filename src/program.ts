import seedrandom from "seedrandom";
import {
    action,
    computed,
    makeObservable,
    observable,
    runInAction,
} from "mobx";

import {
    BitmapRenderer,
    IsometricRenderer,
    VoxelPathTracer,
    Renderer,
} from "./render";

import { Helper } from "./helpers/helper";
import { Loader } from "./helpers/loader";
import { VoxHelper } from "./helpers/vox";
import { Interpreter } from "./interpreter";

import ModelsXML from "../static/models.xml";
import PaletteXML from "../static/resources/palette.xml";
import { NodeState, NodeStateInfo } from "./state";
import { Branch, Node, ScopeNode } from "./nodes";
import { Optimization } from "./wasm/optimization";

import ace from "ace-builds";
import "ace-builds/src-noconflict/mode-xml";

export type ProgramOutput = { name: string; buffer: ArrayBuffer };

export interface ProgramParams {
    steps?: number;
}

const Render3DTypes = {
    isometric: IsometricRenderer,
    voxel: VoxelPathTracer,
};

export class Program {
    @observable.ref
    public static instance: Model = null;

    @observable
    public static models: Map<string, Element> = new Map();

    @observable
    public static palette: Map<string, Uint8ClampedArray> = new Map();

    public static meta = seedrandom();

    public static readonly editor = ace.edit(null, {
        wrap: true,
        readOnly: true,
        useWorker: false,
        maxLines: Infinity,
        mode: "ace/mode/xml",
    });

    @action
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

    @action
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

            runInAction(tryInsert);
        }
    }

    @action
    public static load(name: string) {
        if (this.instance) {
            this.instance.stop();
            this.instance = null;
        }

        const model = new Model(name);
        if (!model.load()) return null;
        runInAction(() => (this.instance = model));
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
    private breakpoints: Set<Node> = new Set();

    @observable
    public renderer: Renderer;

    @observable
    private _curr: Generator<[Uint8Array, string, number, number, number]> =
        null;

    @observable
    private _seed: number = null;
    @observable
    private _speed = 0;
    @observable
    private _delay = 0;
    @observable
    private _paused = false;

    private _loadPromise: Promise<boolean>;
    private _timer = 0;
    private _steps = -1;

    private default3DrenderType = VoxelPathTracer.supported
        ? "voxel"
        : "isometric";
    private rendered = 0;

    @observable
    public loading = false;

    @observable
    public output: ProgramOutput = null;

    @observable.deep
    public nodes: NodeStateInfo[] = [];
    @observable
    public curr_node_index = -1;

    public readonly DIM = new Int32Array([-1, -1, -1]);

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

        this.renderer =
            this.DIM[2] === 1
                ? new BitmapRenderer()
                : new Render3DTypes[this.default3DrenderType]();

        this.renderer.clear();

        document
            .getElementById("model-canvas")
            .replaceWith(this.renderer.canvas);
        this.renderer.canvas.id = "model-canvas";

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

            Program.editor.setValue(this.modelXML);
            Program.editor.clearSelection();

            const seedString = emodel.getAttribute("seeds");
            const seeds = seedString?.split(" ").map((s) => parseInt(s));

            const customPalette = new Map(Program.palette.entries());
            for (const ec of Helper.childrenByTag(emodel, "color")) {
                customPalette.set(
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

            runInAction(() => {
                this.nodes = NodeState.traverse(this.ip);
                for (const { state } of this.nodes) state.sync();

                this.renderer.palette = customPalette;

                const qs = new URLSearchParams(location.search);
                const qsSeed = parseInt(qs.get("seed"));

                this._seed = isNaN(qsSeed)
                    ? seeds?.[0] || Program.meta.int32()
                    : qsSeed;
            });

            const [state, chars, FX, FY, FZ] = this.ip.state();

            this.renderer.setCharacters(chars);
            this.renderer.update(FX, FY, FZ);
            this.renderer.render(state);

            return true;
        })();

        makeObservable(this);
    }

    @action
    public debug() {
        debugger;
    }

    @action
    public load() {
        return this._loadPromise;
    }

    @computed
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

    @computed
    public get speed() {
        return this._delay ? -this._delay : this._speed;
    }

    @computed
    public get running() {
        return !!this._curr;
    }

    @computed
    public get seed() {
        return this._seed;
    }

    @action
    public start(params?: ProgramParams) {
        if (this._curr) this._curr.throw(new Error("Interrupt"));
        this._curr = null;
        this.output = null;

        if (this.loading) return Promise.resolve(false);
        this.loading = true;

        return this._loadPromise.then(async (loaded) => {
            if (!loaded) return false;

            this._steps = params?.steps || -1;

            runInAction(() => {
                this.loading = false;
                this._timer = 0;
                this._paused = false;
                this.loop();
            });

            return true;
        });
    }

    @action
    public pause() {
        this._paused = true;
    }

    @action
    public resume() {
        this._paused = false;
        this.loop();
    }

    @action
    public step() {
        this._paused = true;
        this.loop(true);
    }

    @action
    public randomize() {
        this._seed = Program.meta.int32();
    }

    private loop(once = false, render = true) {
        if (!once && this._paused) return;

        const start = performance.now();

        if (!this._curr) this._curr = this.ip?.run(this._seed, this._steps);
        if (!this._curr) return;

        const checkBreakpoint = () =>
            runInAction(() => {
                if (once) return false;

                const br = this.ip.current;
                if (!br) return false;
                if (br.n < 0 || br.n >= br.children.length) return false;

                if (
                    this.breakpoints.has(br) ||
                    this.breakpoints.has(br.children[br.n])
                ) {
                    this._paused = true;
                    return true;
                }
                return false;
            });

        let result = this._curr.next();
        const bp = checkBreakpoint();

        if (!bp && !once && this._speed > 0) {
            for (let i = 0; i < this._speed; i++) {
                result = this._curr.next();
                if (checkBreakpoint()) break;

                // Cap per frame execution to 20ms/50fps
                if (performance.now() - start > 20) break;
            }
        }

        const end = performance.now();
        this._timer += end - start;

        // Update UI hooks should not be timed
        this.curr_node_index = this.nodes.findIndex(({ state }) => {
            let br = this.ip.current;
            if (!br) return false;

            if (br.n < 0 || br.n >= br.children.length) {
                return state.node === br;
            }

            let cn = br.children[br.n];
            while (cn instanceof ScopeNode) {
                if (cn.n < 0 || cn.n >= br.children.length)
                    return state.node === cn;
                cn = cn.children[cn.n];
            }

            if (cn instanceof Branch) {
                if (cn.n < 0 || cn.n >= cn.children.length) {
                    return state.node === cn;
                } else {
                    return state.node === cn.children[cn.n];
                }
            }

            return state.node === cn;
        });

        {
            const highlightState = this.nodes[this.curr_node_index]?.state;
            for (const { state } of this.nodes) {
                state.isCurrent = state === highlightState;
                state.sync();
            }
        }

        if (result.done) {
            this._curr = null;

            const [state, chars, FX, FY, FZ] = this.ip.state();

            this.ip.onRender();
            this.renderer.setCharacters(chars);
            this.renderer.update(FX, FY, FZ);
            this.renderer.render(state);
            this.rendered++;

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
                    ? setTimeout(
                          () => runInAction(() => this.loop()),
                          this._delay
                      )
                    : requestAnimationFrame(() =>
                          runInAction(() => this.loop())
                      );

            if (render) {
                const [state, chars, FX, FY, FZ] = result.value;

                this.ip.onRender();
                this.renderer.setCharacters(chars);
                this.renderer.update(FX, FY, FZ);
                this.renderer.render(state);
                this.rendered++;
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

    @computed
    public get MX() {
        return this.DIM[0];
    }

    @computed
    public get MY() {
        return this.DIM[1];
    }

    @computed
    public get MZ() {
        return this.DIM[2];
    }

    @computed
    public get renderType() {
        const r = this.renderer;

        if (r instanceof BitmapRenderer) return "bitmap";
        if (r instanceof IsometricRenderer) return "isometric";
        if (r instanceof VoxelPathTracer) return "voxel";

        return null;
    }

    @action
    public toggleBreakpoint(index: number) {
        const node = this.nodes[index];
        if (!node) return;
        node.breakpoint = !node.breakpoint;

        if (node.breakpoint) {
            this.breakpoints.add(node.state.node);
        } else {
            this.breakpoints.delete(node.state.node);
        }
    }

    @action
    public toggleRender(type: "isometric" | "voxel") {
        const palette = this.renderer.palette;

        const oldCanvas = this.renderer.canvas;
        this.renderer.dispose();
        this.rendered = 0;

        this.renderer = new Render3DTypes[type]();
        this.renderer.palette = palette;
        this.renderer.clear();

        oldCanvas.replaceWith(this.renderer.canvas);
        this.renderer.canvas.id = oldCanvas.id;

        if (!this.ip) return;

        const [state, chars, FX, FY, FZ] = this.ip.state();

        this.ip.onRender();
        this.renderer.setCharacters(chars);
        this.renderer.update(FX, FY, FZ);
        this.renderer.render(state);
        this.rendered++;
    }

    @action
    public stop() {
        this.pause();
        this.renderer.dispose();
        // point of this is to call RuleNode.searching.throw
        // which breaks the scope that keeps the webassembly instance "alive" (not gc'd)
        this.ip?.root.reset();

        Program.editor.setValue("");
        Program.editor.resize(true);
    }

    @action
    public event(name: string, key: string) {
        const curr = this.ip?.listener;
        if (!curr) return;

        curr.event(name, key);
    }
}
