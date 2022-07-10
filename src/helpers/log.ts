import { saveAs } from "file-saver";

export class Log {
    private logs: string[] = [];
    log(l: string) {
        this.logs.push(l);
    }

    save(name: string) {
        saveAs(new Blob([this.logs.join("\n")], { type: "text/plain" }), name);
    }
}
