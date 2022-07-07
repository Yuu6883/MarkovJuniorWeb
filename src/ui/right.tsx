import { observer } from "mobx-react-lite";
import { useContext } from "react";
import { ProgramContext } from ".";

import { Helper } from "../helpers/helper";
import { MapNode, RuleNode } from "../nodes";
import { Rule } from "../rule";

export const RightPanel = observer(() => {
    const model = useContext(ProgramContext).instance;
    const colors = model?.renderer.colors;
    const chars = model?.renderer.characters;

    return (
        <div id="right-column">
            {model && (
                <>
                    <div id="palette-container">
                        <h4>Palette</h4>
                        <div>
                            {Array.from(
                                { length: colors.length >>> 2 },
                                (_, k) => (
                                    <input
                                        key={k}
                                        type="color"
                                        defaultValue={Helper.rgb2hex(
                                            colors.subarray(
                                                k << 2,
                                                (k << 2) + 4
                                            )
                                        )}
                                        onChange={(e) => {
                                            const rgba = Helper.hex2rgba(
                                                e.target.value
                                            );
                                            model.renderer.updateSymbol(
                                                chars.charAt(k),
                                                rgba
                                            );
                                            model.renderer.updateColors();
                                        }}
                                    />
                                )
                            )}
                        </div>
                    </div>
                    <StateViz />
                </>
            )}
        </div>
    );
});

const RuleViz = ({ rule, colors }: { rule: Rule; colors: Uint8Array }) => {
    const [IMX, IMY, IMZ, OMX, OMY, OMZ] = rule.IO_DIM;

    const shrink = IMX > 5 || IMY > 5 || OMX > 5 || OMY > 5;
    return (
        <div className="rule" data-size={shrink ? "small" : "normal"}>
            <table>
                <tbody>
                    {Array.from({ length: IMY }, (_, y) => (
                        <tr key={y}>
                            {Array.from({ length: IMX }, (_, x) => {
                                const value = rule.binput[x + y * IMX];
                                return (
                                    <td
                                        key={x}
                                        style={{
                                            backgroundColor: Helper.rgb2hex(
                                                colors.subarray(
                                                    value << 2,
                                                    (value << 2) + 4
                                                )
                                            ),
                                        }}
                                    ></td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            <label>🡒</label>
            <table>
                <tbody>
                    {Array.from({ length: OMY }, (_, y) => (
                        <tr key={y}>
                            {Array.from({ length: OMX }, (_, x) => {
                                const value = rule.output[x + y * OMX];
                                return (
                                    <td
                                        key={x}
                                        data-transparent={value === 0xff}
                                        style={{
                                            backgroundColor: Helper.rgb2hex(
                                                colors.subarray(
                                                    value << 2,
                                                    (value << 2) + 4
                                                )
                                            ),
                                        }}
                                    ></td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const StateViz = observer(() => {
    const model = useContext(ProgramContext).instance;
    const active_index = model.curr_node_index;

    return (
        !!model.nodes.length && (
            <>
                <h4>Node Tree</h4>
                <div id="state-viz">
                    {model.nodes.map(({ state, depth, index }, i) => {
                        const n = state.source;

                        return (
                            <div
                                key={i}
                                style={{
                                    marginLeft: `${depth * 2}em`,
                                    color:
                                        active_index === i
                                            ? "cornflowerblue"
                                            : "white",
                                }}
                                className="node-state"
                                data-level-index={index}
                            >
                                <label>{state.name}</label>
                                <div className="rule-list">
                                    {(n instanceof RuleNode ||
                                        n instanceof MapNode) &&
                                        n.rules.map(
                                            (r, key) =>
                                                r.original && (
                                                    <RuleViz
                                                        key={key}
                                                        rule={r}
                                                        colors={
                                                            model.renderer
                                                                .colors
                                                        }
                                                    />
                                                )
                                        )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        )
    );
});
