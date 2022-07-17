import { makeObservable } from "mobx";
import { createContext } from "react";
import ReactTooltip from "react-tooltip";
import { createRoot } from "react-dom/client";
import { Program } from "../program";
import { ControlPanel } from "./center";
import { LeftPanel } from "./left";
import { MobileSelect } from "./mobile";
import { RightPanel } from "./right";

import "./style/index.css";

makeObservable(Program);
export const ProgramContext = createContext<typeof Program>(null);

window.addEventListener("keydown", (e) => {
    if (e.key === "F4") {
        Program.instance?.benchmark();
        e.preventDefault();
    }
    Program.instance?.event("keydown", e.key);
});

window.addEventListener("keyup", (e) => {
    Program.instance?.event("keyup", e.key);
});

const App = () => {
    return (
        <ProgramContext.Provider value={Program}>
            <LeftPanel />
            <ControlPanel />
            <RightPanel />
            <MobileSelect />
            <ReactTooltip className="tooltip" />
        </ProgramContext.Provider>
    );
};

const root = createRoot(document.getElementById("app"));
root.render(<App />);
