import { Array2D, BoolArray2D } from "../helpers/array";
import { Rule } from "../rule";

export abstract class RuleNode extends Node {
    public rules: Rule[];
    public counter: number;
    public steps: number;

    protected matches: [number, number, number, number][];
    protected matchCount: number;
    protected lastMatchedTurn: number;
    protected matchMask: BoolArray2D;

    protected potentials: Array2D<Int32Array>;
}
