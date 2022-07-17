import { RunState } from "..";
import { Node } from "../node";

export class LogNode extends Node {
    private msg: string;
    public override async load(elem: Element) {
        const msg = elem.getAttribute("message");

        if (!msg) {
            console.error(elem, "message is required for <log> node");
            return false;
        }

        this.msg = msg;
        return true;
    }

    public reset(): void {}

    public run(): RunState {
        console.log(this.msg);
        return RunState.FAIL;
    }
}

Node.registerExt("log", LogNode);
