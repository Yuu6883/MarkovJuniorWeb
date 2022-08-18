import { Loader } from "../loader";

import * as path from "path";
import * as fsp from "fs/promises";
import { loadImage, createCanvas, createImageData } from "canvas";

import { VoxHelper } from "../helpers/vox";

export const patchForNode = () => {
    Loader.xml = async (file: string) => {
        const text = await fsp.readFile(
            path.resolve(__dirname, "..", "..", "static", file),
            "utf-8"
        );
        try {
            return { text, elem: Loader.xmlParse(text) };
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    Loader.vox = async (
        file: string
    ): Promise<[Int32Array, number, number, number]> => {
        const buf = await fsp.readFile(
            path.resolve(__dirname, "..", "..", "static", file)
        );
        try {
            return VoxHelper.read(buf.buffer);
        } catch (e) {
            console.error(e);
            return [null, -1, -1, -1];
        }
    };

    Loader.bitmap = async (
        file: string
    ): Promise<[Int32Array, number, number, number]> => {
        try {
            const buf = await fsp.readFile(
                path.resolve(__dirname, "..", "..", "static", file)
            );

            const bitmap = await loadImage(buf);

            const canvas = createCanvas(bitmap.width, bitmap.height);

            const context = canvas.getContext("2d");
            context.drawImage(bitmap, 0, 0);

            const { data, width, height } = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

            return [new Int32Array(data.buffer), width, height, 1];
        } catch (e) {
            console.error(e);
            return [null, -1, -1, -1];
        }
    };

    Loader.makeCanvas = () => {
        const canvas = <any>createCanvas(0, 0);
        canvas.style = {};
        return canvas;
    };

    Loader.makeImageData = createImageData;
};
