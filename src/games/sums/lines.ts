// Treasure Map lines (rows and columns): every shape their clue allows (where the two X's
// go, how the digits split into groups), worked out once per puzzle, and the ways a line
// can still be filled given what each cell can be. The steps that use them are in logic.ts.

import { bitsOf, cellName, listJoin } from "../logic";
import type { SumsPuzzle } from "./engine";

export interface Shape {
  /** Positions (in the line) of the two X's. */
  xs: number[];
  /** The groups of digits: [start, length]. */
  runs: [number, number][];
  /** Ways to split the digits: one digit mask per group (bit d = digit d). */
  parts: number[][];
}

export interface Line {
  name: string;
  cells: number[];
  clue: number[];
  shapes: Shape[];
}

// ---------------------------------------------------------------------------
// Lines and their possible shapes, worked out once per puzzle

export const subsetCache = new Map<number, Map<string, number[]>>();
/** Digit sets of 1..m by size and sum: key "size,sum" -> masks. */
export function subsets(m: number): Map<string, number[]> {
  const hit = subsetCache.get(m);
  if (hit) return hit;
  const out = new Map<string, number[]>();
  for (let s = 1; s < 1 << m; s++) {
    const ds = bitsOf(s).map((b) => b + 1);
    const key = `${ds.length},${ds.reduce((a, b) => a + b, 0)}`;
    out.set(key, [...(out.get(key) ?? []), s << 1]);
  }
  subsetCache.set(m, out);
  return out;
}

export const lineCache = new WeakMap<SumsPuzzle, Line[]>();
export function linesOf(p: SumsPuzzle): Line[] {
  const hit = lineCache.get(p);
  if (hit) return hit;
  const n = p.n;
  const m = n - 2;
  const subs = subsets(m);
  const shapesFor = (clue: number[]): Shape[] => {
    const out: Shape[] = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const runs: [number, number][] = [];
        let start = -1;
        for (let k = 0; k <= n; k++) {
          const digit = k < n && k !== i && k !== j;
          if (digit && start < 0) start = k;
          if (!digit && start >= 0) {
            runs.push([start, k - start]);
            start = -1;
          }
        }
        if (runs.length !== clue.length) continue;
        const parts: number[][] = [];
        const pick = (r: number, used: number, acc: number[]) => {
          if (r === runs.length) return void parts.push(acc.slice());
          for (const s of subs.get(`${runs[r][1]},${clue[r]}`) ?? [])
            if (!(s & used)) {
              acc.push(s);
              pick(r + 1, used | s, acc);
              acc.pop();
            }
        };
        pick(0, 0, []);
        if (parts.length) out.push({ xs: [i, j], runs, parts });
      }
    return out;
  };
  const lines: Line[] = [];
  for (let r = 0; r < n; r++) lines.push({ name: `row ${r + 1}`, cells: Array.from({ length: n }, (_, c) => r * n + c), clue: p.rowClues[r], shapes: shapesFor(p.rowClues[r]) });
  for (let c = 0; c < n; c++) lines.push({ name: `column ${c + 1}`, cells: Array.from({ length: n }, (_, r) => r * n + c), clue: p.colClues[c], shapes: shapesFor(p.colClues[c]) });
  lineCache.set(p, lines);
  return lines;
}


export const setName = (mask: number) => `{${bitsOf(mask).join(",")}}`;

/** All ways (X positions and digit groups) a line can still be filled; the union per cell. */
export function lineWays(all: number[], line: Line): { ways: number; union: number[]; examples: string[] } {
  const n = line.cells.length;
  const union = new Array(n).fill(0);
  const examples: string[] = [];
  let ways = 0;
  const dom = line.cells.map((c) => all[c]);
  for (const shape of line.shapes) {
    if (!shape.xs.every((k) => dom[k] & 1)) continue;
    let digitsOk = true;
    for (const [st, len] of shape.runs) for (let k = st; k < st + len; k++) if (!(dom[k] & ~1)) digitsOk = false;
    if (!digitsOk) continue;
    for (const part of shape.parts) {
      let ok = true;
      for (let r = 0; r < shape.runs.length && ok; r++) {
        const [st, len] = shape.runs[r];
        const set = part[r];
        let reach = 0;
        for (let k = st; k < st + len; k++) {
          if (!(dom[k] & set)) ok = false;
          reach |= dom[k] & set;
        }
        if (reach !== set) ok = false; // every digit of the group needs a place in it
      }
      if (!ok) continue;
      ways++;
      for (const k of shape.xs) union[k] |= 1;
      shape.runs.forEach(([st, len], r) => {
        for (let k = st; k < st + len; k++) union[k] |= dom[k] & part[r];
      });
      if (examples.length < 4) examples.push(`X's in ${listJoin(shape.xs.map((k) => cellName(n, line.cells[k])))} with ${shape.runs.map((_, r) => setName(part[r])).join(" + ")}`);
    }
  }
  return { ways, union, examples };
}

/** The same with the order of the digits inside each group: every arrangement that fits. */
export function lineArrangements(all: number[], line: Line): { ways: number; union: number[] } {
  const n = line.cells.length;
  const union = new Array(n).fill(0);
  let ways = 0;
  const dom = line.cells.map((c) => all[c]);
  const val = new Array(n).fill(0);
  for (const shape of line.shapes) {
    if (!shape.xs.every((k) => dom[k] & 1)) continue;
    const digitCells = shape.runs.flatMap(([st, len]) => Array.from({ length: len }, (_, k) => st + k));
    for (const part of shape.parts) {
      const allowed = new Array(n).fill(0);
      shape.runs.forEach(([st, len], r) => {
        for (let k = st; k < st + len; k++) allowed[k] = dom[k] & part[r];
      });
      if (digitCells.some((k) => !allowed[k])) continue;
      const assign = (i: number, used: number) => {
        if (i === digitCells.length) {
          ways++;
          for (const k of shape.xs) union[k] |= 1;
          for (const k of digitCells) union[k] |= 1 << val[k];
          return;
        }
        const k = digitCells[i];
        for (const b of bitsOf(allowed[k] & ~used)) {
          val[k] = b;
          assign(i + 1, used | (1 << b));
        }
      };
      assign(0, 0);
    }
  }
  return { ways, union };
}

/** Ways a line's clue allows before anything is known. */
export const staticWays = (line: Line) => line.shapes.reduce((a, sh) => a + sh.parts.length, 0);
