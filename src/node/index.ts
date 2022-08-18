import fs from "fs";
import fsp from "fs/promises";
import path from "path";

import { Canvas } from "canvas";

import { Program } from "./program";
import { BitmapRenderer } from "../render/bitmap";
import { VoxHelper } from "../helpers/vox";
import { Renderer } from "../render/abstract";
import { IsometricRenderer } from "../render/isometric";

const outDir = path.resolve(__dirname, "..", "..", "output");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

(async () => {
    Program.listModels();
    Program.loadPalette();

    for (const name of Program.models.keys()) {
        // We don't run sokoban in node, takes too long?
        if (name.includes("SOKOBAN")) continue;
        const model = Program.load(name);
        const loaded = await model.load();

        if (!loaded) {
            console.log(`Failed to load model: "${name}"`);
            continue;
        }

        console.log(`> ${name}`);

        for (let i = 0; i < model.amount; i++) {
            model.run(true);

            const [state, chars, FX, FY, FZ] = model.state();
            const output: { name: string; buffer: NodeJS.ArrayBufferView } = {
                name: null,
                buffer: null,
            };

            if (FZ > 1 && !i) {
                const colors = chars.split("").map((c) => model.palette.get(c));

                output.name = `${name}_${model.seed}.vox`;
                output.buffer = new Uint8Array(
                    VoxHelper.serialize(state, FX, FY, FZ, colors)
                );
            } else {
                const renderer: Renderer =
                    FZ > 1 ? new IsometricRenderer() : new BitmapRenderer();
                renderer.palette = model.palette;
                renderer.setCharacters(chars);
                renderer.update(FX, FY, FZ);
                renderer.render(state);

                const canvas = renderer.canvas as unknown as Canvas;

                output.name = `${name}_${model.seed}.png`;
                output.buffer = canvas.toBuffer("image/png");
            }

            await fsp.writeFile(
                path.resolve(outDir, output.name),
                output.buffer
            );
        }
    }
})();
