import { observer } from "mobx-react-lite";
import { useContext, useEffect, useState } from "react";
import { ProgramContext } from ".";

export const LeftPanel = observer(() => {
    const Prog = useContext(ProgramContext);
    const model = Prog.instance;

    const [search, setSearch] = useState("");

    useEffect(() => {
        Prog.loadPalette();
        Prog.listModels();

        const m = localStorage.getItem("last-mj-model");
        // let the page fully load
        if (m) setTimeout(() => Prog.load(m), 500);
    }, []);

    const names = [...Prog.models.keys()];

    return (
        <div id="left-column">
            <h1 id="title">
                MarkovJunior{" "}
                <i
                    className="fa-brands fa-github"
                    onClick={() =>
                        window.open(
                            "https://github.com/Yuu6883/MarkovJuniorWeb"
                        )
                    }
                ></i>
            </h1>
            <div id="search-model">
                <div id="input-holder">
                    <input
                        type="text"
                        defaultValue={search}
                        onChange={(e) => setSearch(e.target.value.trim())}
                        placeholder="Filter model by name"
                    ></input>
                    <i className="fa-solid fa-magnifying-glass"></i>
                </div>
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
                            onClick={() => {
                                Prog.load(k);
                                localStorage.setItem("last-mj-model", k);
                            }}
                        >
                            {k}
                        </div>
                    ))}
            </div>
        </div>
    );
});
