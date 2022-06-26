import { saveAs } from "file-saver";
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BitmapRenderer } from "../helpers/graphics";
import { Program } from "../main";

import "./style/index.css";

const ControlPanel = forwardRef(
    (
        {
            model,
            close,
        }: {
            model: string;
            close: () => void;
        },
        ref: React.MutableRefObject<HTMLCanvasElement>
    ) => {
        const [prog, setProg] = useState(Program.init(null, null));
        const [speed, setSpeed] = useState(0);
        const [running, setRunning] = useState(false);
        const [output, setOutput] = useState<{
            name: string;
            buffer: ArrayBuffer;
        }>(null);

        useEffect(() => {
            const prog = Program.init(model, ref.current);
            if (!prog) return close();

            setProg(prog);
            setOutput(null);
            setRunning(false);

            return () => void prog.abort();
        }, [model]);

        useEffect(() => {
            if (prog) prog.setSpeed(speed);
            else setSpeed(0);
        }, [speed]);

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
                        </p>
                        <div className="control-buttons">
                            {running ? (
                                <button
                                    className="danger"
                                    onClick={() =>
                                        prog
                                            .abort()
                                            .then(
                                                (stopped) =>
                                                    stopped && setRunning(false)
                                            )
                                    }
                                >
                                    stop
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        prog.start({ speed }).then((result) => {
                                            if (result) {
                                                const { time, output } = result;
                                                setOutput(output);
                                            }
                                            setRunning(false);
                                        });

                                        setOutput(null);
                                        setRunning(true);
                                    }}
                                >
                                    start
                                </button>
                            )}

                            {output && (
                                <button
                                    onClick={() =>
                                        saveAs(
                                            new Blob([output.buffer]),
                                            output.name
                                        )
                                    }
                                >
                                    Download output
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="speed">
                        <label>Speed</label>
                        <input
                            className="speed-bar"
                            type="range"
                            min="-200"
                            max="200"
                            value={speed}
                            onChange={(e) => setSpeed(e.target.valueAsNumber)}
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
    const ref = useRef(document.createElement("canvas"));

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

            <div className="canvas-container">
                {model && (
                    <ControlPanel
                        ref={ref}
                        model={model}
                        close={() => setModel(null)}
                    />
                )}
                <canvas className="canvas" ref={ref}></canvas>
            </div>
        </>
    );
};

const root = createRoot(document.getElementById("app"));
root.render(<App />);
