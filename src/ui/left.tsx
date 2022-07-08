import { observer } from "mobx-react-lite";
import { useContext, useEffect, useMemo, useState } from "react";
import { ProgramContext } from ".";

export const LeftPanel = observer(() => {
    const Prog = useContext(ProgramContext);
    const model = Prog.instance;

    const [search, setSearch] = useState("");

    useEffect(() => {
        Prog.loadPalette();
        Prog.listModels();
    }, []);

    const names = [...Prog.models.keys()];

    return (
        <div id="left-column">
            <h1 id="title">MarkovJunior</h1>
            <div id="search-model">
                <input
                    type="text"
                    defaultValue={search}
                    onChange={(e) => setSearch(e.target.value.trim())}
                ></input>
            </div>
            <div id="model-list">
                {names
                    .filter((n) =>
                        n.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((k) => (
                        <div
                            key={k}
                            data-selected={model?.key === k}
                            onClick={() => Prog.load(k)}
                        >
                            {k}
                        </div>
                    ))}
            </div>
        </div>
    );
});
