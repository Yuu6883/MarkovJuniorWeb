import { observer } from "mobx-react-lite";
import { useContext } from "react";
import { ProgramContext } from ".";

export const MobileSelect = observer(() => {
    const Prog = useContext(ProgramContext);

    return (
        <div id="mobile-select">
            <select
                defaultValue="disabled"
                onChange={(e) => Prog.load(e.target.value)}
            >
                <option value="disabled" disabled>
                    SELECT MODEL
                </option>
                {[...Prog.models.keys()].map((k) => (
                    <option key={k} value={k}>
                        {k}
                    </option>
                ))}
            </select>
        </div>
    );
});
