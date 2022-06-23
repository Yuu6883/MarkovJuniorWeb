import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Graphics } from "../helpers/graphics";
import { Main } from "../main";

import "./style/index.css";

const App = () => {
    const ref = useRef(document.createElement("canvas"));

    useEffect(() => {
        Graphics.init(ref.current);
        Main();
    }, []);

    return <canvas ref={ref}></canvas>;
};

const root = createRoot(document.getElementById("app"));
root.render(<App />);
