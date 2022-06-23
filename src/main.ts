import seedrandom from "seedrandom";
import { Graphics } from "./helpers/graphics";
import { Helper } from "./helpers/helper";
import { Loader } from "./helpers/loader";
import { Interpreter } from "./interpreter";

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

export const Main = async () => {
    const ep = await Loader.xml("resources/palette.xml");
    const ecolors = Helper.collectionToArr(ep.querySelectorAll("color"));
    const palette = new Map(
        ecolors.map((e) => [
            e.getAttribute("symbol").charAt(0),
            Helper.hex2rgba(e.getAttribute("value")),
        ])
    );

    const meta = seedrandom();
    const doc = await Loader.xml("models.xml");

    for (const emodel of Helper.collectionToArr(
        doc.querySelectorAll("model")
    )) {
        const name = emodel.getAttribute("name");
        const linearSize = parseInt(emodel.getAttribute("size")) || -1;
        const dimension = parseInt(emodel.getAttribute("d")) || 2;

        const MX = parseInt(emodel.getAttribute("length")) || linearSize;
        const MY = parseInt(emodel.getAttribute("width")) || linearSize;
        const MZ =
            parseInt(emodel.getAttribute("height")) ||
            (dimension === 2 ? 1 : linearSize);

        if (name !== "Growth") continue;

        console.log(`${name} >`);
        const path = `models/${name}.xml`;
        const mdoc = await Loader.xml(path);
        if (!mdoc) {
            console.error(`Failed to load ${path}`);
            continue;
        }

        const interpreter = await Interpreter.load(mdoc, MX, MY, MZ);
        if (!interpreter) {
            console.error(`Interpreter.load failed ${path}`);
            continue;
        }

        let amount = parseInt(emodel.getAttribute("amount")) || 2;
        const pixelsize = parseInt(emodel.getAttribute("pixelsize")) || 4;
        const seedString = emodel.getAttribute("seeds");
        const seeds = seedString?.split(" ").map((s) => parseInt(s));

        const gif = emodel.getAttribute("gif") === "True";
        const iso = emodel.getAttribute("iso") === "True";
        const steps =
            parseInt(emodel.getAttribute("steps")) || (gif ? 1000 : 50000);

        // const gui = parseInt(emodel.getAttribute("gui")) || 0;
        const gui = true;

        if (gif) amount = 1;
        for (let k = 0; k < amount; k++) {
            const seed = seeds?.[k] || meta.int32();

            for (const [result, legend, FX, FY, FZ] of interpreter.run(
                seed,
                steps,
                gif
            )) {
                const colors = legend.split("").map((c) => palette.get(c));
                if (FZ === 1 || iso) {
                    await Graphics.renderBitmap(
                        result,
                        FX,
                        FY,
                        colors,
                        pixelsize
                    );
                } else {
                    // TODO: save VOX / render
                }

                await frame();
            }

            console.log("DONE");
        }

        break; // LET'S JUST LOAD ONE
    }
};
