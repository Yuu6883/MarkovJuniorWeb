import { observer } from "mobx-react-lite";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ProgramContext } from ".";

import { Helper } from "../helpers/helper";
import { MapNode, RuleNode } from "../nodes";
import { Rule } from "../rule";
import { RuleState } from "../state";

const Palette = observer(() => {
    const model = useContext(ProgramContext).instance;
    const colors = model.renderer.colorHex;
    const chars = model.renderer.characters;
    const [RAF, setRAF] = useState(0);

    return (
        <div id="palette-container">
            <h4>Palette</h4>
            <div>
                {colors.map((v, k) => (
                    <input
                        key={k}
                        type="color"
                        defaultValue={v}
                        onChange={(e) => {
                            if (RAF) cancelAnimationFrame(RAF);
                            setRAF(
                                requestAnimationFrame(() => {
                                    const rgba = Helper.hex2rgba(
                                        e.target.value
                                    );
                                    model.renderer.updateSymbol(
                                        chars.charAt(k),
                                        rgba
                                    );
                                    model.renderer.updateColors();
                                    setRAF(0);
                                })
                            );
                        }}
                    />
                ))}
            </div>
        </div>
    );
});

export const RightPanel = observer(() => {
    const model = useContext(ProgramContext).instance;

    return (
        <div id="right-column">
            {model && (
                <>
                    <Palette />
                    <StateViz />
                </>
            )}
        </div>
    );
});

const Cell = observer(({ value }: { value: number }) => {
    const colors = useContext(ProgramContext).instance.renderer.colorHex;
    return (
        <td
            data-transparent={value === 0xff}
            style={{
                backgroundColor: colors[value],
            }}
        ></td>
    );
});

const RuleViz = ({
    rule,
    children,
}: {
    rule: Rule;
    children?: React.ReactNode;
}) => {
    const [IMX, IMY, IMZ, OMX, OMY, OMZ] = rule.IO_DIM;

    const iGrid = useMemo(
        () =>
            Array.from({ length: IMZ }, (_, z) => (
                <table
                    key={z}
                    style={{
                        top: `${z * 5}px`,
                        left: `${z * 5}px`,
                        zIndex: IMZ - z,
                        opacity: z ? (IMZ - z) / IMZ / 2 + 0.25 : 1,
                    }}
                >
                    <tbody>
                        {Array.from({ length: IMY }, (_, y) => (
                            <tr key={y}>
                                {Array.from({ length: IMX }, (_, x) => (
                                    <Cell
                                        key={x}
                                        value={
                                            rule.binput[
                                                x + y * IMX + z * IMX * IMY
                                            ]
                                        }
                                    />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )),
        [IMX, IMY, IMZ]
    );

    const oGrid = useMemo(
        () =>
            Array.from({ length: OMZ }, (_, z) => (
                <table
                    key={z}
                    style={{
                        top: `${z * 5}px`,
                        left: `${z * 5}px`,
                        zIndex: OMZ - z,
                        opacity: z ? (OMZ - z) / OMZ / 2 + 0.25 : 1,
                    }}
                >
                    <tbody>
                        {Array.from({ length: OMY }, (_, y) => (
                            <tr key={y}>
                                {Array.from({ length: OMX }, (_, x) => (
                                    <Cell
                                        key={x}
                                        value={
                                            rule.output[
                                                x + y * OMX + z * OMX * OMY
                                            ]
                                        }
                                    />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )),
        [OMX, OMY, OMZ]
    );

    const shrink = IMX > 5 || IMY > 5 || OMX > 5 || OMY > 5;

    return (
        <div className="rule" data-size={shrink ? "small" : "normal"}>
            <div
                className="grid"
                style={{
                    width: `calc((var(--size) + 1px) * ${IMX} + ${IMZ * 5}px)`,
                    height: `calc((var(--size) + 1px) * ${IMY} + ${IMZ * 5}px)`,
                }}
            >
                {iGrid}
            </div>
            <i className="fa-solid fa-arrow-right"></i>
            <div
                className="grid"
                style={{
                    width: `calc((var(--size) + 1px) * ${OMX} + ${OMZ * 5}px)`,
                    height: `calc((var(--size) + 1px) * ${OMY} + ${OMZ * 5}px)`,
                }}
            >
                {oGrid}
            </div>
            {children}
        </div>
    );
};

const StateViz = observer(() => {
    const model = useContext(ProgramContext).instance;
    const ref = useRef<HTMLDivElement>();

    useEffect(() => {
        const list = ref.current;
        if (!list) return;
        const elem = list.children[model.curr_node_index] as HTMLDivElement;
        if (!elem) return;

        elem.scrollIntoView({
            behavior:
                Math.abs(list.scrollTop - elem.offsetTop) > 800
                    ? "auto"
                    : "smooth",
        });
    }, [model.curr_node_index]);

    return (
        !!model.nodes.length && (
            <>
                <h4>Node Tree</h4>
                <div id="state-viz" ref={ref}>
                    {model.nodes.map(
                        ({ state, depth, index, breakpoint }, i) => {
                            const n = state.source;

                            return (
                                <div
                                    key={i}
                                    style={{
                                        marginLeft: `${depth * 2}em`,
                                    }}
                                    className="node-state"
                                    data-level-index={index}
                                    data-highlight={model.curr_node_index === i}
                                    data-breakpoint={breakpoint}
                                >
                                    <label
                                        onClick={() =>
                                            model.toggleBreakpoint(i)
                                        }
                                    >
                                        {state.name}
                                    </label>
                                    <div className="rule-list">
                                        {(n instanceof RuleNode ||
                                            n instanceof MapNode) && (
                                            <>
                                                {n.rules.map(
                                                    (r, key) =>
                                                        r.original && (
                                                            <RuleViz
                                                                key={key}
                                                                rule={r}
                                                            >
                                                                {!key &&
                                                                    state instanceof
                                                                        RuleState &&
                                                                    state.steps >
                                                                        0 && (
                                                                        <label>
                                                                            {state.counter.toString()}
                                                                            /
                                                                            {state.steps.toString()}
                                                                        </label>
                                                                    )}
                                                            </RuleViz>
                                                        )
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                    )}
                </div>
            </>
        )
    );
});
