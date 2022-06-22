import { Grid } from "./grid";

export abstract class Node {
    protected abstract load(elem: Element, symmetry: boolean[], grid: Grid);
}
