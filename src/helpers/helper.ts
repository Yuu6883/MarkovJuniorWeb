import { PRNG } from "seedrandom";

interface WritableArray<T> {
    readonly length: number;
    [n: number]: T;
}

export class Helper {
    public static split2(s: string, s1: string, s2: string) {
        return s.split(s1).map((l) => l.split(s2));
    }

    public static firstNonZeroPosition(w: number) {
        for (let p = 0; p < 32; p++, w >>= 1) if ((w & 1) === 1) return p;
        return 0xff;
    }

    public static sampleWeights(weights: Float64Array, r: number) {
        let sum = 0;
        for (let i = 0; i < weights.length; i++) sum += weights[i];
        let threshold = r * sum;

        let partialSum = 0;
        for (let i = 0; i < weights.length; i++) {
            partialSum += weights[i];
            if (partialSum >= threshold) return i;
        }
        return 0;
    }

    public static collectionToArr<T extends Element>(c: HTMLCollectionOf<T>) {
        const arr: T[] = [];
        for (let i = 0; i < c.length; i++) {
            arr.push(c.item(i));
        }
        return arr;
    }

    public static maxPositiveIndex<T extends ArrayLike<number>>(amounts: T) {
        let max = -1,
            argmax = -1;
        for (let i = 0; i < amounts.length; i++) {
            let amount = amounts[i];
            if (amount > 0 && amount > max) {
                max = amount;
                argmax = i;
            }
        }
        return argmax;
    }

    public static shuffleFill<T extends WritableArray<number>>(
        array: T,
        rng: PRNG
    ) {
        for (let i = 0; i < array.length; i++) {
            const j = range(rng, i + 1);
            array[i] = array[j];
            array[j] = i;
        }
    }

    public static pick<E, T extends ArrayLike<E>>(array: T, rng: PRNG) {
        return array[range(rng, array.length)];
    }
}

// exclusive
export const range = (rng: PRNG, upper: number) => Math.floor(rng() * upper);

export type vec3 = [number, number, number];
