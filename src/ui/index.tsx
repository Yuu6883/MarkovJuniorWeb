import { saveAs } from "file-saver";
import { observer } from "mobx-react-lite";
import { useEffect, useId, useState } from "react";
import { createRoot } from "react-dom/client";
import { Program } from "../program";
import { VoxelPathTracer } from "../render";

import "./style/index.css";

const debug = location.hostname === "localhost";
const rtx = VoxelPathTracer.supported;

const ControlPanel = observer(
    ({ model, close }: { model: string; close: () => void }) => {
        const [prog, setProg] = useState<Program>(null);
        const id = useId();

        useEffect(() => {
            if (!model) return () => {};

            const prog = new Program(model, id);
            prog.load().then((loaded) =>
                loaded ? console.log(`Model loaded: ${model}`) : close()
            );
            setProg(prog);

            // make the loop stop and make the prog go out of scope
            return () => void prog.stop();
        }, [model]);

        return (
            <>
                <div id="controls">
                    <h3 id="model-select">{model}</h3>
                    {prog && (
                        <>
                            {" "}
                            <p>
                                size:{" "}
                                {prog.MZ > 1
                                    ? `${prog.MX}x${prog.MY}x${prog.MZ}`
                                    : `${prog.MX}x${prog.MY}`}
                                {"  "}
                                seed: {prog.seed}
                            </p>
                            {prog.loading ? (
                                <p>loading...</p>
                            ) : (
                                <div id="control-buttons">
                                    {prog.running ? (
                                        <button
                                            onClick={() => {
                                                prog.paused
                                                    ? prog.resume()
                                                    : prog.pause();
                                            }}
                                        >
                                            {prog.paused ? "resume" : "pause"}
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => prog.start()}
                                            >
                                                Start
                                            </button>
                                            <button
                                                onClick={() => prog.randomize()}
                                            >
                                                Randomize Seed
                                            </button>
                                        </>
                                    )}
                                    {prog.paused && (
                                        <button onClick={() => prog.step()}>
                                            Step
                                        </button>
                                    )}
                                    {prog.output && (
                                        <button
                                            id="vox-download"
                                            onClick={() =>
                                                saveAs(
                                                    new Blob([
                                                        prog.output.buffer,
                                                    ]),
                                                    prog.output.name
                                                )
                                            }
                                        >
                                            Download Output
                                        </button>
                                    )}
                                    {rtx &&
                                        prog.renderType !== "bitmap" &&
                                        prog.MZ > 1 && (
                                            <button
                                                onClick={() =>
                                                    prog.toggleRender(
                                                        prog.renderType ===
                                                            "voxel"
                                                            ? "isometric"
                                                            : "voxel"
                                                    )
                                                }
                                            >
                                                {prog.renderType === "voxel"
                                                    ? "Isometric"
                                                    : "Voxel"}
                                            </button>
                                        )}
                                    {debug && (
                                        <button
                                            id="debug"
                                            onClick={() => prog.debug()}
                                        >
                                            debug 😭
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <canvas id={id} />
                {prog && (
                    <div id="speed">
                        <label
                            style={{
                                left: `${((prog.speed + 200) / 400) * 100}%`,
                            }}
                        >
                            {prog.speed >= 0
                                ? `x${prog.speed || 1}`
                                : `${-prog.speed}ms`}
                        </label>
                        <input
                            id="speed-bar"
                            type="range"
                            min={-200}
                            max={200}
                            step={1}
                            value={prog.speed}
                            onChange={(e) =>
                                (prog.speed = e.target.valueAsNumber)
                            }
                        />
                    </div>
                )}
            </>
        );
    }
);

Program.loadPalette();
Program.listModels();

const App = () => {
    const [model, setModel] = useState<string>(null);

    return (
        <>
            <div id="left-column">
                <h1 id="title">MarkovJunior</h1>
                <div id="model-list">
                    {[...Program.models.keys()].map((k) => (
                        <div
                            key={k}
                            data-selected={model === k}
                            onClick={() => setModel(k)}
                        >
                            {k}
                        </div>
                    ))}
                </div>
            </div>
            <div id="right-column">
                <ControlPanel model={model} close={() => setModel(null)} />
            </div>
            <div id="mobile-select">
                <select
                    defaultValue="disabled"
                    onChange={(e) => setModel(e.target.value)}
                >
                    <option value="disabled" disabled>
                        SELECT MODEL
                    </option>
                    {[...Program.models.keys()].map((k) => (
                        <option key={k} value={k}>
                            {k}
                        </option>
                    ))}
                </select>
            </div>
        </>
    );
};

const root = createRoot(document.getElementById("app"));
root.render(<App />);
