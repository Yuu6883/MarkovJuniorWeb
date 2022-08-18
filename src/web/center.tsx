import { saveAs } from "file-saver";
import { observer } from "mobx-react-lite";
import { useContext, useEffect } from "react";
import ReactTooltip from "react-tooltip";
import { ProgramContext } from ".";
import { VoxelPathTracer } from "../render";

const debug = location.hostname === "localhost";
const rtx = VoxelPathTracer.supported;

export const ControlPanel = observer(() => {
    const prog = useContext(ProgramContext);

    const model = prog.instance;

    useEffect(() => {
        ReactTooltip.hide();
        ReactTooltip.rebuild();
    }, [model?.running, model?.paused, model?.renderType]);

    return (
        <div id="center-column">
            <div id="controls">
                <h3 id="model-select">{model?.name}</h3>
                {model && (
                    <>
                        {" "}
                        <p>
                            size:{" "}
                            {model.MZ > 1
                                ? `${model.MX}x${model.MY}x${model.MZ}`
                                : `${model.MX}x${model.MY}`}
                            {"  "}
                            seed: {model.seed}
                        </p>
                        {model.loading ? (
                            <p>loading...</p>
                        ) : (
                            <div id="control-buttons">
                                {model.running ? (
                                    <button
                                        onClick={() => {
                                            model.paused
                                                ? model.resume()
                                                : model.pause();
                                        }}
                                        data-tip={
                                            model.paused ? "Resume" : "Pause"
                                        }
                                    >
                                        {model.paused ? (
                                            <i className="fa-solid fa-play"></i>
                                        ) : (
                                            <i className="fa-solid fa-pause"></i>
                                        )}
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => model.start()}
                                            data-tip="Play"
                                        >
                                            <i className="fa-solid fa-play"></i>
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => model.step()}
                                    data-tip="Step"
                                >
                                    <i className="fa-solid fa-forward-step"></i>
                                </button>
                                <button
                                    onClick={() => model.randomize()}
                                    disabled={model.running}
                                    data-tip="Randomize Seed"
                                >
                                    <i className="fa-solid fa-dice"></i>
                                </button>
                                {model.output && (
                                    <button
                                        id="vox-download"
                                        onClick={() =>
                                            saveAs(
                                                new Blob([model.output.buffer]),
                                                model.output.name
                                            )
                                        }
                                        data-tip="Download Output (.vox)"
                                    >
                                        <i className="fa-solid fa-download"></i>
                                    </button>
                                )}
                                {rtx &&
                                    model.renderType !== "bitmap" &&
                                    model.MZ > 1 && (
                                        <button
                                            onClick={() =>
                                                model.toggleRender(
                                                    model.renderType === "voxel"
                                                        ? "isometric"
                                                        : "voxel"
                                                )
                                            }
                                            data-tip={
                                                model.renderType === "voxel"
                                                    ? "Isometric View"
                                                    : "3D View"
                                            }
                                        >
                                            {model.renderType === "voxel" ? (
                                                <i className="fa-solid fa-cubes"></i>
                                            ) : (
                                                <i className="fa-solid fa-video"></i>
                                            )}
                                        </button>
                                    )}
                                {debug && (
                                    <button
                                        id="debug"
                                        onClick={() => model.debug()}
                                    >
                                        <i
                                            className="fa-solid fa-bug"
                                            data-tip="Debug 😭"
                                        ></i>
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            <canvas id="model-canvas" />
            {model && (
                <div id="speed">
                    <label
                        style={{
                            left: `${((model.speed + 200) / 400) * 100}%`,
                        }}
                    >
                        {model.speed >= 0
                            ? `x${model.speed || 1}`
                            : `${-model.speed}ms`}
                    </label>
                    <input
                        id="speed-bar"
                        type="range"
                        min={-100}
                        max={100}
                        step={1}
                        value={model.speed}
                        onChange={(e) => (model.speed = e.target.valueAsNumber)}
                    />
                </div>
            )}
        </div>
    );
});
