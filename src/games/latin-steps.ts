// Steps shared by the Latin-square puzzles (Futoshiki, Calcudoku): every row and column holds
// 1..n once. The state keeps, per cell, a mask of the digits still possible (bit d = digit d).
import { bitsOf, cellName, describeEliminations, listJoin, onlyBit, popcount } from "./logic";
import type { CellValue, LiteStep } from "./logic";

export interface LatinState {
  dom: number[];
  placed: boolean[];
}

/** A step finder: a step, "contradiction" when the state can't be right, or null. */
export type LatinFinder = (p: { n: number }, s: LatinState) => LiteStep | "contradiction" | null;

const linesCache = new Map<number, { name: string; cells: number[] }[]>();
export function linesOf(n: number) {
  const hit = linesCache.get(n);
  if (hit) return hit;
  const out: { name: string; cells: number[] }[] = [];
  for (let r = 0; r < n; r++) out.push({ name: `row ${r + 1}`, cells: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) out.push({ name: `column ${c + 1}`, cells: Array.from({ length: n }, (_, r) => r * n + c) });
  linesCache.set(n, out);
  return out;
}

export const cloneLatin = (s: LatinState): LatinState => ({ dom: s.dom.slice(), placed: s.placed.slice() });

export function placeLatin(p: { n: number }, s: LatinState, cell: number, v: number): void {
  const n = p.n;
  s.dom[cell] = 1 << v;
  s.placed[cell] = true;
  const r = Math.floor(cell / n);
  const c = cell % n;
  for (let k = 0; k < n; k++) {
    if (r * n + k !== cell) s.dom[r * n + k] &= ~(1 << v);
    if (k * n + c !== cell) s.dom[k * n + c] &= ~(1 << v);
  }
}

export const single: LatinFinder = (p, s) => {
  for (let i = 0; i < s.dom.length; i++) {
    if (!s.dom[i]) return "contradiction";
    if (!s.placed[i] && popcount(s.dom[i]) === 1) {
      const v = onlyBit(s.dom[i]);
      return {
        technique: "Single",
        level: 1,
        weight: 0,
        placements: [{ cell: i, value: v }],
        eliminations: [],
        region: [i],
        nudge: "One cell has only one digit left.",
        explanation: `Every other digit is ruled out for ${cellName(p.n, i)}, so it is ${v}.`,
      };
    }
  }
  return null;
};

export const hiddenSingle: LatinFinder = (p, s) => {
  for (const line of linesOf(p.n))
    for (let d = 1; d <= p.n; d++) {
      const at = line.cells.filter((c) => s.dom[c] & (1 << d));
      if (!at.length) return "contradiction";
      if (at.length === 1 && !s.placed[at[0]])
        return {
          technique: "Hidden Single",
          level: 1,
          weight: 0,
          placements: [{ cell: at[0], value: d }],
          eliminations: [],
          region: line.cells,
          nudge: `Look for a digit with only one place left in ${line.name}.`,
          explanation: `In ${line.name}, the ${d} can only go in ${cellName(p.n, at[0])}.`,
        };
    }
  return null;
};

/** Naked and hidden subsets of a size in each line. */
export const subsets =
  (k: number): LatinFinder =>
  (p, s) => {
    const n = p.n;
    const name = k === 2 ? "Pair" : "Triple";
    for (const line of linesOf(n)) {
      const open = line.cells.filter((c) => !s.placed[c]);
      const choose = (arr: number[], size: number, start = 0, acc: number[] = []): number[][] =>
        acc.length === size ? [acc.slice()] : arr.slice(start).flatMap((x, i) => choose(arr, size, start + i + 1, [...acc, x]));
      // Naked: k cells holding only k digits between them.
      for (const cells of choose(open, k)) {
        const union = cells.reduce((m, c) => m | s.dom[c], 0);
        if (popcount(union) !== k) continue;
        const elims: CellValue[] = [];
        for (const c of open) if (!cells.includes(c)) for (const v of bitsOf(s.dom[c] & union)) elims.push({ cell: c, value: v });
        if (!elims.length) continue;
        return {
          technique: `Naked ${name}`,
          level: k === 2 ? 3 : 3.5,
          weight: k === 2 ? 4 : 6,
          placements: [],
          eliminations: elims,
          region: line.cells,
          nudge: `Look for ${k} cells in ${line.name} that share ${k} digits.`,
          explanation: `In ${line.name}, ${listJoin(cells.map((c) => cellName(n, c)))} can only hold ${listJoin(bitsOf(union).map(String))} between them, so those digits go there and nowhere else in the ${line.name.split(" ")[0]}: ${describeEliminations(n, elims)}.`,
          parts: [{ elims, text: `${listJoin(cells.map((c) => cellName(n, c)))} hold ${listJoin(bitsOf(union).map(String))} between them, so ${describeEliminations(n, elims).replace(/can't be/g, "isn't")}` }],
        };
      }
      // Hidden: k digits with only k places between them.
      const missing = Array.from({ length: n }, (_, d) => d + 1).filter((d) => !line.cells.some((c) => s.placed[c] && s.dom[c] === 1 << d));
      for (const ds of choose(missing, k)) {
        const mask = ds.reduce((m, d) => m | (1 << d), 0);
        const at = open.filter((c) => s.dom[c] & mask);
        if (at.length !== k) continue;
        const elims: CellValue[] = [];
        for (const c of at) for (const v of bitsOf(s.dom[c] & ~mask)) elims.push({ cell: c, value: v });
        if (!elims.length) continue;
        return {
          technique: `Hidden ${name}`,
          level: k === 2 ? 3 : 3.5,
          weight: k === 2 ? 4 : 6,
          placements: [],
          eliminations: elims,
          region: line.cells,
          nudge: `Look for ${k} digits that have the same ${k} places left in ${line.name}.`,
          explanation: `In ${line.name}, ${listJoin(ds.map(String))} can only go in ${listJoin(at.map((c) => cellName(n, c)))}, so those cells hold just them: ${describeEliminations(n, elims)}.`,
          parts: [{ elims, text: `${listJoin(ds.map(String))} can only go in ${listJoin(at.map((c) => cellName(n, c)))} in ${line.name}, so ${describeEliminations(n, elims).replace(/can't be/g, "isn't")}` }],
        };
      }
    }
    return null;
  };

