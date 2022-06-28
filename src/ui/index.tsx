import { saveAs } from "file-saver";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Program } from "../program";

import "./style/index.css";

const debug = location.hostname === "localhost";

const ControlPanel = observer(
    ({ model, close }: { model: string; close: () => void }) => {
        const [prog, setProg] = useState<Program>(null);

        useEffect(() => {
            const prog = new Program(model);
            prog.load().then((loaded) =>
                loaded ? console.log(`Model loaded: ${model}`) : close()
            );
            setProg(prog);

            // make the loop stop and make the prog go out of scope
            return () => void prog.stop();
        }, [model]);

        return (
            prog && (
                <>
                    <div className="controls">
                        <h3>{model}</h3>
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
                            <div className="control-buttons">
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
                                        <button onClick={() => prog.start()}>
                                            start
                                        </button>
                                        <button
                                            onClick={() => prog.randomize()}
                                        >
                                            randomize seed
                                        </button>
                                    </>
                                )}
                                {prog.paused && (
                                    <button onClick={() => prog.step()}>
                                        step
                                    </button>
                                )}
                                {debug && (
                                    <button onClick={() => prog.debug()}>
                                        debug 😭
                                    </button>
                                )}
                                {prog.output && (
                                    <button
                                        onClick={() =>
                                            saveAs(
                                                new Blob([prog.output.buffer]),
                                                prog.output.name
                                            )
                                        }
                                    >
                                        Download output
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="speed">
                        <label>Speed</label>
                        <input
                            className="speed-bar"
                            type="range"
                            min="-200"
                            max="200"
                            value={prog.speed}
                            onChange={(e) =>
                                (prog.speed = e.target.valueAsNumber)
                            }
                        />
                    </div>
                </>
            )
        );
    }
);

const App = () => {
    const [loaded, setLoaded] = useState(false);
    const [model, setModel] = useState<string>(null);

    useEffect(() => {
        Promise.all([Program.loadPalette(), Program.listModels()]).then(() =>
            setLoaded(true)
        );
    }, []);

    return (
        <>
            <div>
                <h1>MarkovJunior</h1>
                <div className="model-list">
                    {loaded &&
                        [...Program.models.keys()].map((k) => (
                            <div
                                key={k}
                                aria-selected={model === k}
                                onClick={() => setModel(k)}
                            >
                                {k}
                            </div>
                        ))}
                </div>
            </div>

            <div id="canvas-container">
                {model && (
                    <ControlPanel model={model} close={() => setModel(null)} />
                )}
            </div>
        </>
    );
};

const root = createRoot(document.getElementById("app"));
root.render(<App />);
