import { observer } from "mobx-react-lite";
import { useContext, useEffect } from "react";
import { ProgramContext } from ".";

export const LeftPanel = observer(() => {
    const Prog = useContext(ProgramContext);
    const model = Prog.instance;

    useEffect(() => {
        Prog.loadPalette();
        Prog.listModels();
    }, []);

    return (
        <div id="left-column">
            <h1 id="title">MarkovJunior</h1>
            <div id="model-list">
                {[...Prog.models.keys()].map((k) => (
                    <div
                        key={k}
                        data-selected={model?.name === k}
                        onClick={() => Prog.load(k)}
                    >
                        {k}
                    </div>
                ))}
            </div>
        </div>
    );
});
