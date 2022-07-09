import type ASC from "assemblyscript/dist/asc";

declare global {
    const asc: typeof ASC;
    interface Window {
        ascLoadPromise: Promise<void>;
        ascLoadResolve: Function;
    }
}
