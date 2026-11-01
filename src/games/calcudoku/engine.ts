// Calcudoku: an n×n grid where every row and column holds 1..n once, cut into cages. Each
// cage has a target and an operation: the digits in it add up (+), multiply (×), or, in a
// cage of two cells, differ by (−) or divide to (÷) the target. A cage of one cell is a given
// digit. Digits may repeat inside a cage as long as they're not in the same row or column.
//
// This file: the puzzle, its cages and codes, and a brute-force solution counter (tests).
// The step-by-step solver, rating and generation are in logic.ts.

import { linesHold, packB62, shuffle, unpackB62 } from "../latin";

export type Op = "=" | "+" | "−" | "×" | "÷";
export const OPS: Op[] = ["=", "+", "−", "×", "÷"];

export interface Cage {
  cells: number[];
  op: Op;
  target: number;
}

export interface CalcPuzzle {
  n: number;
  solution: number[];
  /** Cage number of every cell. */
  cageOf: number[];
  cages: Cage[];
  /** Single-cell cages are shown as given digits. */
  givens: boolean[];
}

export const CALC_SIZES = [5, 6, 7];

/** The target of a cage with this operation, from its digits. */
export function targetOf(op: Op, ds: number[]): number {
  switch (op) {
    case "=":
      return ds[0];
    case "+":
      return ds.reduce((a, b) => a + b, 0);
    case "×":
      return ds.reduce((a, b) => a * b, 1);
    case "−":
      return Math.abs(ds[0] - ds[1]);
    case "÷":
      return Math.max(ds[0], ds[1]) / Math.min(ds[0], ds[1]);
  }
}

/** Whether digits `ds` (all of the cage) meet the cage. */
export const meets = (c: Cage, ds: number[]) => (c.op === "÷" ? Math.max(...ds) % Math.min(...ds) === 0 && targetOf("÷", ds) === c.target : targetOf(c.op, ds) === c.target);

/** Build a puzzle from a solution, the cage of each cell and each cage's operation. */
export function buildCalc(n: number, solution: number[], cageOf: number[], ops: Op[]): CalcPuzzle {
  const cages: Cage[] = ops.map((op) => ({ cells: [], op, target: 0 }));
  cageOf.forEach((k, i) => cages[k].cells.push(i));
  for (const c of cages) c.target = targetOf(c.op, c.cells.map((i) => solution[i]));
  return { n, solution, cageOf, cages, givens: cageOf.map((k) => cages[k].cells.length === 1) };
}

/**
 * Random cages: grow regions from random cells to a random size (weights per size), merge
 * leftover single cells into a neighbour now and then, and pick an operation for each.
 */
export function randomCages(n: number, solution: number[], rnd: () => number, sizeWeights: number[] = [0, 0.06, 0.44, 0.35, 0.15]): CalcPuzzle {
  const cageOf = new Array(n * n).fill(-1);
  const nb = (i: number) => {
    const r = Math.floor(i / n);
    const c = i % n;
    return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((j) => j >= 0);
  };
  const pickSize = () => {
    let x = rnd() * sizeWeights.reduce((a, b) => a + b, 0);
    for (let s = 0; s < sizeWeights.length; s++) if ((x -= sizeWeights[s]) < 0) return s;
    return 2;
  };
  const sizes: number[] = [];
  for (const start of shuffle([...Array(n * n).keys()], rnd)) {
    if (cageOf[start] >= 0) continue;
    const k = sizes.length;
    const want = pickSize();
    const cells = [start];
    cageOf[start] = k;
    while (cells.length < want) {
      const open = [...new Set(cells.flatMap(nb))].filter((j) => cageOf[j] < 0);
      if (!open.length) break;
      const j = open[Math.floor(rnd() * open.length)];
      cageOf[j] = k;
      cells.push(j);
    }
    sizes.push(cells.length);
  }
  // A lone cell that wasn't meant to be one joins a small neighbouring cage (most of the time).
  for (let i = 0; i < n * n; i++) {
    if (sizes[cageOf[i]] !== 1 || rnd() < 0.3) continue;
    const small = nb(i).filter((j) => sizes[cageOf[j]] < 4);
    if (!small.length) continue;
    const to = cageOf[small[Math.floor(rnd() * small.length)]];
    sizes[cageOf[i]] = 0;
    cageOf[i] = to;
    sizes[to]++;
  }
  // Renumber (drop emptied cages) and pick operations.
  const renum = new Map<number, number>();
  for (const k of cageOf) if (!renum.has(k)) renum.set(k, renum.size);
  const ids = cageOf.map((k) => renum.get(k)!);
  const members: number[][] = Array.from({ length: renum.size }, () => []);
  ids.forEach((k, i) => members[k].push(i));
  const ops: Op[] = members.map((cells) => {
    const ds = cells.map((i) => solution[i]);
    if (cells.length === 1) return "=";
    if (cells.length === 2) {
      const [a, b] = ds;
      const x = rnd();
      if (Math.max(a, b) % Math.min(a, b) === 0 && x < 0.3) return "÷";
      if (x < 0.65) return "−";
      return x < 0.85 ? "+" : "×";
    }
    return rnd() < 0.55 ? "+" : "×";
  });
  return buildCalc(n, solution, ids, ops);
}

/** Count solutions (up to `limit`): backtracking cell by cell, checking each cage when it's full. */
export function countCalc(p: CalcPuzzle, limit = 2): number {
  const { n } = p;
  const v = new Array(n * n).fill(0);
  const filled = p.cages.map(() => 0);
  let count = 0;
  const go = (i: number): void => {
    if (count >= limit) return;
    if (i === n * n) return void count++;
    const r = Math.floor(i / n);
    const c = i % n;
    const cage = p.cages[p.cageOf[i]];
    for (let d = 1; d <= n; d++) {
      let ok = true;
      for (let k = 0; k < n && ok; k++) if (v[r * n + k] === d || v[k * n + c] === d) ok = false;
      if (!ok) continue;
      v[i] = d;
      const k = p.cageOf[i];
      filled[k]++;
      const ds = cage.cells.map((j) => v[j]).filter(Boolean);
      const full = filled[k] === cage.cells.length;
      const fine = full ? meets(cage, ds) : cage.op === "+" ? ds.reduce((a, b) => a + b, 0) < cage.target : cage.op === "×" ? cage.target % ds.reduce((a, b) => a * b, 1) === 0 : true;
      if (fine) go(i + 1);
      filled[k]--;
      v[i] = 0;
      if (count >= limit) return;
    }
  };
  go(0);
  return count;
}

// ---------------------------------------------------------------------------
// Codes: "K6-<solution>-<cage of each cell>-<operation of each cage>", packed into base 62.

export function encodeCalc(p: CalcPuzzle): string {
  return `K${p.n}-${packB62(p.solution.map((v) => v - 1), p.n)}-${packB62(p.cageOf, p.n * p.n)}-${packB62(p.cages.map((c) => OPS.indexOf(c.op)), OPS.length)}`;
}

export const isCalcCode = (s: string) => /^K[3-9]-[0-9A-Za-z]+-[0-9A-Za-z]+-[0-9A-Za-z]+$/.test(s.trim());

export function decodeCalc(code: string): CalcPuzzle {
  const m = /^K([3-9])-([0-9A-Za-z]+)-([0-9A-Za-z]+)-([0-9A-Za-z]+)$/.exec(code.trim());
  if (!m) throw new Error("Not a Calcudoku code.");
  const n = Number(m[1]);
  const solution = unpackB62(m[2], n, n * n).map((v) => v + 1);
  if (!linesHold(n, (i) => solution[i], Array.from({ length: n }, (_, k) => k + 1))) throw new Error("This code doesn't hold a valid Calcudoku grid.");
  const cageOf = unpackB62(m[3], n * n, n * n);
  const count = Math.max(...cageOf) + 1;
  const ops = unpackB62(m[4], OPS.length, count).map((k) => OPS[k]);
  const p = buildCalc(n, solution, cageOf, ops);
  if (p.cages.some((c) => !c.cells.length || (c.op === "=" && c.cells.length !== 1) || ((c.op === "−" || c.op === "÷") && c.cells.length !== 2)))
    throw new Error("This code doesn't hold valid cages.");
  return p;
}
