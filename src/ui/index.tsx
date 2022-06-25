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
    const [params, setParams] = useState<ProgramParams>({});
    const [running, setRunning] = useState(false);

    useEffect(() => {
        const prog = Program.init(model);
        if (!prog) return close();

        setProg(prog);
        setRunning(false);

        return () => void prog.abort();
    }, [model]);

    return (
        prog && (
            <div className="controls">
                <h2>{model}</h2>
                <p>
                    size:{" "}
                    {prog.dimension === 3
                        ? `${prog.MX}x${prog.MY}x${prog.MZ}`
                        : `${prog.MX}x${prog.MY}`}
                </p>
                {running ? (
                    <button
                        onClick={() =>
                            prog
                                .abort()
                                .then((stopped) => stopped && setRunning(false))
                        }
                    >
                        stop
                    </button>
                ) : (
                    <button
                        disabled={prog.dimension === 3}
                        onClick={() => (
                            prog
                                .start(params)
                                .then((result) => result && setRunning(false)),
                            setRunning(true)
                        )}
                    >
                        start
                    </button>
                )}
            </div>
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
            <div className="model-list">
                {loaded &&
                    [...Program.models.keys()].map((k) => (
                        <div key={k} onClick={() => setModel(k)}>
                            {k}
                        </div>
                    ))}
            </div>
            <div className="canvas-container">
                {model && (
                    <ControlPanel model={model} close={() => setModel(null)} />
                )}
                <canvas ref={ref}></canvas>
            </div>
        </>
    );
};

const root = createRoot(document.getElementById("app"));
root.render(<App />);
