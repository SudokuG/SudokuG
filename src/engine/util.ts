// Small helpers shared by the technique files.
import { Grid, PEERS, UNITS, Unit, bit, cellName } from "./grid";

export const unitIdx = (u: Unit) => UNITS.indexOf(u);

/** Units in the order a human tends to scan them: boxes, then rows, then columns. */
export const SCAN_ORDER: Unit[] = [...UNITS.slice(18), ...UNITS.slice(0, 18)];

/** Empty cells of a unit that still have digit d as a candidate. */
export function positions(g: Grid, u: Unit, d: number): number[] {
  return u.cells.filter((c) => !g.values[c] && g.cands[c] & bit(d));
}

export function placedInUnit(g: Grid, u: Unit, d: number): boolean {
  return u.cells.some((c) => g.values[c] === d);
}

export const hasCand = (g: Grid, c: number, d: number) => !g.values[c] && (g.cands[c] & bit(d)) !== 0;

/** SEES[a*81+b] is true when cells a and b are different and share a row, column or box. */
const SEES = new Uint8Array(81 * 81);
for (let a = 0; a < 81; a++) for (const b of PEERS[a]) SEES[a * 81 + b] = 1;
export const sees = (a: number, b: number) => SEES[a * 81 + b] === 1;

/** All k-element combinations of an array. */
export function* combinations<T>(arr: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc.slice();
    return;
  }
  for (let i = start; i <= arr.length - (k - acc.length); i++) {
    acc.push(arr[i]);
    yield* combinations(arr, k, i + 1, acc);
    acc.pop();
  }
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Candidate in chain notation, e.g. "(4)r3c1". */
export const cdName = (cell: number, d: number) => `(${d})${cellName(cell)}`;
