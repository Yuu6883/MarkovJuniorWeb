import { Grid } from "./grid";
import { Branch } from "./node";

export class Interpreter {
    public grid: Grid;

    public root: Branch;
    public current: Branch;
}
