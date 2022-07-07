import { makeObservable } from "mobx";
import { createContext } from "react";
import { createRoot } from "react-dom/client";
import { Program } from "../program";
import { ControlPanel } from "./center";
import { LeftPanel } from "./left";
import { MobileSelect } from "./mobile";
import { RightPanel } from "./right";

import "./style/index.css";

makeObservable(Program);
export const ProgramContext = createContext<typeof Program>(null);

const App = () => {
    return (
        <ProgramContext.Provider value={Program}>
            <LeftPanel />
            <ControlPanel />
            <RightPanel />
            <MobileSelect />
        </ProgramContext.Provider>
    );
};

const root = createRoot(document.getElementById("app"));
root.render(<App />);
