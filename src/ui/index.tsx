import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Graphics } from "../helpers/graphics";
import { Program, ProgramParams } from "../main";

import "./style/index.css";

const ControlPanel = ({
    model,
    close,
}: {
    model: string;
    close: () => void;
}) => {
    const [prog, setProg] = useState(Program.init(null));
    const [speed, setSpeed] = useState(0);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        const prog = Program.init(model);
        if (!prog) return close();

        setProg(prog);
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
                    {prog.MZ > 1 && <p>3D models not implemented yet</p>}
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
                            disabled={prog.dimension === 3}
                            onClick={() => (
                                prog
                                    .start({ speed })
                                    .then(
                                        (result) => result && setRunning(false)
                                    ),
                                setRunning(true)
                            )}
                        >
                            start
                        </button>
                    )}
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
};

const App = () => {
    const [loaded, setLoaded] = useState(false);
    const [model, setModel] = useState<string>(null);
    const ref = useRef(document.createElement("canvas"));

    useEffect(() => {
        Graphics.init(ref.current);

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
                    <ControlPanel model={model} close={() => setModel(null)} />
                )}
                <canvas className="canvas" ref={ref}></canvas>
            </div>
        </>
    );
};

const root = createRoot(document.getElementById("app"));
root.render(<App />);
