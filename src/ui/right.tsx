import { observer } from "mobx-react-lite";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ProgramContext } from ".";
import { Field } from "../field";

import { Helper } from "../helpers/helper";
import { ConvolutionRule, MapNode, RuleNode } from "../nodes";
import { Rule } from "../rule";
import {
    ConvChainState,
    ConvolutionState,
    MapState,
    NodeState,
    PathState,
    RuleState,
} from "../state";

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
                    <StateTree />
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

const RuleViz = observer(
    ({ rule, children }: { rule: Rule; children?: React.ReactNode }) => {
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
                        width: `calc((var(--size) + 1px) * ${IMX} + ${
                            IMZ * 5
                        }px)`,
                        height: `calc((var(--size) + 1px) * ${IMY} + ${
                            IMZ * 5
                        }px)`,
                    }}
                >
                    {iGrid}
                </div>
                <i className="fa-solid fa-arrow-right"></i>
                <div
                    className="grid"
                    style={{
                        width: `calc((var(--size) + 1px) * ${OMX} + ${
                            OMZ * 5
                        }px)`,
                        height: `calc((var(--size) + 1px) * ${OMY} + ${
                            OMZ * 5
                        }px)`,
                    }}
                >
                    {oGrid}
                </div>
                {children}
            </div>
        );
    }
);

const FieldViz = ({ field, c }: { c: number; field: Field }) => (
    <div className="field">
        <label>field</label>
        <table>
            <tbody>
                <tr>
                    <Cell value={c} />
                </tr>
            </tbody>
        </table>
        <label>{field.inversed ? "from" : "to"}</label>
        <table>
            <tbody>
                <tr>
                    {Helper.nonZeroPositions(field.zero).map((v, i) => (
                        <Cell key={i} value={v} />
                    ))}
                </tr>
            </tbody>
        </table>
        <label>on</label>
        <table>
            <tbody>
                <tr>
                    {Helper.nonZeroPositions(field.substrate).map((v, i) => (
                        <Cell key={i} value={v} />
                    ))}
                </tr>
            </tbody>
        </table>
        <label>Recompute: {String(field.recompute)}</label>
        <label>Essential: {String(field.essential)}</label>
    </div>
);

const RuleNodeViz = observer(
    ({ state }: { state: RuleState<RuleNode> | MapState }) => (
        <>
            <div className="rule-list">
                {state.source.rules.map(
                    (r, key) =>
                        r.original && (
                            <RuleViz key={key} rule={r}>
                                {!key && state instanceof RuleState && (
                                    <>
                                        {state.steps > 0 && (
                                            <label>
                                                {state.counter}/{state.steps}
                                            </label>
                                        )}
                                        {state.temperature > 0 && (
                                            <label>
                                                temperature: {state.temperature}
                                            </label>
                                        )}
                                    </>
                                )}
                                {!key && r.p < 1 && (
                                    <label>p = {r.p.toFixed(4)}</label>
                                )}
                            </RuleViz>
                        )
                )}
            </div>
            {state instanceof RuleState && state.source.fields && (
                <div className="field-list">
                    {state.source.fields.map(
                        (field, i) =>
                            field && <FieldViz key={i} c={i} field={field} />
                    )}
                </div>
            )}
        </>
    )
);

const ConvChainViz = observer(({ state }: { state: ConvChainState }) => {
    const { SMX, SMY, c0, c1, sample } = state;

    const grid = useMemo(
        () =>
            Array.from({ length: SMY }, (_, y) => (
                <tr key={y}>
                    {Array.from({ length: SMX }, (_, x) => (
                        <Cell value={sample[x + y * SMX] ? c1 : c0} />
                    ))}
                </tr>
            )),
        [SMX, SMY]
    );

    const shrink = SMX > 5 || SMY > 5;

    return (
        <table
            className="convchain-sample"
            data-size={shrink ? "small" : "normal"}
        >
            <tbody>{grid}</tbody>
        </table>
    );
});

const PathViz = observer(({ state }: { state: PathState }) => {
    return (
        <div className="path-state">
            <div>
                <label>from</label>
                <table>
                    <tbody>
                        <tr>
                            {state.from.map((v, i) => (
                                <Cell key={i} value={v} />
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div>
                <label>to</label>
                <table>
                    <tbody>
                        <tr>
                            {state.to.map((v, i) => (
                                <Cell key={i} value={v} />
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div>
                <label>on</label>
                <table>
                    <tbody>
                        <tr>
                            {state.on.map((v, i) => (
                                <Cell key={i} value={v} />
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div>
                <label>colored</label>
                <table>
                    <tbody>
                        <tr>
                            <Cell value={state.colored} />
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
});

const ConvoRule = observer(({ rule }: { rule: ConvolutionRule }) => (
    <div className="convo-rule">
        <table data-size={"normal"}>
            <tbody>
                <tr>
                    <Cell value={rule.input} />
                </tr>
            </tbody>
        </table>
        <i className="fa-solid fa-arrow-right"></i>
        <table data-size={"normal"}>
            <tbody>
                <tr>
                    <Cell value={rule.output} />
                </tr>
            </tbody>
        </table>
        {rule.values && (
            <>
                <label>values:</label>
                <table data-size={"normal"}>
                    <tbody>
                        <tr>
                            {[...rule.values].map((v, i) => (
                                <Cell key={i} value={v} />
                            ))}
                        </tr>
                    </tbody>
                </table>
            </>
        )}
        {rule.sums && (
            <label>
                sums:{" "}
                {rule.sums.reduceRight(
                    (pre, c, i) => (c ? (pre ? `${i},${pre}` : i) : pre),
                    ""
                )}
            </label>
        )}
        {rule.p < 1 && <label>p = {rule.p}</label>}
    </div>
));

const ConvolutionViz = observer(({ state }: { state: ConvolutionState }) => (
    <>
        {state.steps > 0 && (
            <div>
                {state.counter}/{state.steps}
            </div>
        )}
        <div className="convo-rule-list">
            {state.source.rules.map((r, key) => (
                <ConvoRule key={key} rule={r} />
            ))}
        </div>
    </>
));

const NodeStateViz = observer(({ state }: { state: NodeState }) => {
    return state instanceof RuleState || state instanceof MapState ? (
        <RuleNodeViz state={state} />
    ) : state instanceof ConvChainState ? (
        <ConvChainViz state={state} />
    ) : state instanceof PathState ? (
        <PathViz state={state} />
    ) : state instanceof ConvolutionState ? (
        <ConvolutionViz state={state} />
    ) : (
        <></>
    );
});

const StateTree = observer(() => {
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
                        ({ state, depth, index, breakpoint }, i) => (
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
                                <pre
                                    className="breakpoint"
                                    onClick={() => model.toggleBreakpoint(i)}
                                />
                                <label
                                    onClick={() => model.toggleBreakpoint(i)}
                                >
                                    {state.name}
                                </label>
                                <NodeStateViz state={state} />
                            </div>
                        )
                    )}
                </div>
            </>
        )
    );
});