// Star Battle solver state: what each cell can still be (bit 0 = empty, bit 1 = star), the
// units (rows, columns, regions), placing, and what is impossible on the board (why).
// The steps are in steps.ts, the solving, rating and making in logic.ts.

import { cellName, listJoin } from "../logic";
import type { CellValue, LiteStep } from "../logic";
import { around, touching } from "./engine";
import type { StarPuzzle } from "./engine";

export interface StarState {
  /** Per cell: bit 0 = may be empty, bit 1 = may be a star. */
  dom: number[];
  placed: boolean[];
}

export const EMPTY = 1;
export const STAR = 2;

export interface Unit {
  kind: "row" | "column" | "region";
  index: number;
  name: string;
  cells: number[];
}

export const unitCache = new WeakMap<StarPuzzle, Unit[]>();
/** Rows, then columns, then regions. */
export function unitsOf(p: StarPuzzle): Unit[] {
  let u = unitCache.get(p);
  if (u) return u;
  const n = p.n;
  u = [
    ...Array.from({ length: n }, (_, r) => ({ kind: "row" as const, index: r, name: `row ${r + 1}`, cells: Array.from({ length: n }, (_, c) => r * n + c) })),
    ...Array.from({ length: n }, (_, c) => ({ kind: "column" as const, index: c, name: `column ${c + 1}`, cells: Array.from({ length: n }, (_, r) => r * n + c) })),
    ...p.regions.map((cells, g) => ({ kind: "region" as const, index: g, name: regionName(p, g), cells })),
  ];
  unitCache.set(p, u);
  return u;
}

/** "the region at r1c1" (named by its first cell). */
export const regionName = (p: StarPuzzle, g: number) => `the region at ${cellName(p.n, p.regions[g][0])}`;

export function startState(p: StarPuzzle): StarState {
  return { dom: new Array(p.n * p.n).fill(EMPTY | STAR), placed: new Array(p.n * p.n).fill(false) };
}

export function cloneStars(s: StarState): StarState {
  return { dom: s.dom.slice(), placed: s.placed.slice() };
}

/** Put a star (1) or an empty cell (0) in a cell. */
export function place(_p: StarPuzzle, s: StarState, cell: number, v: number): void {
  s.dom[cell] = v ? STAR : EMPTY;
  s.placed[cell] = true;
}

export function applyStep(p: StarPuzzle, s: StarState, step: LiteStep): void {
  for (const pl of step.placements) place(p, s, pl.cell, pl.value);
}

export const isStar = (s: StarState, i: number) => s.dom[i] === STAR;
export const isOpen = (s: StarState, i: number) => s.dom[i] === (EMPTY | STAR);
export const starsIn = (s: StarState, cells: number[]) => cells.filter((i) => isStar(s, i)).length;
export const openIn = (s: StarState, cells: number[]) => cells.filter((i) => isOpen(s, i));
export const need = (p: StarPuzzle, s: StarState, u: Unit) => p.k - starsIn(s, u.cells);

/** At most how many stars fit among these cells without touching (only 0, 1, 2 or "more" matter). */
export function room(n: number, cells: number[], want: number): number {
  if (want <= 1 || cells.length <= 1) return Math.min(cells.length, Math.max(want, 1));
  // Two cells that don't touch?
  for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) if (!touching(n, cells[a], cells[b])) return 2;
  return 1;
}

export const names = (n: number, cells: number[]) => listJoin(cells.map((i) => cellName(n, i)));
export const starWord = (k: number) => (k === 1 ? "star" : "stars");

export function step(technique: string, level: number, weight: number, placements: CellValue[], region: number[], nudge: string, explanation: string): LiteStep {
  return { technique, level, weight, placements, eliminations: [], region, nudge, explanation };
}

/** Something impossible on the board (what a trial runs into), or null. */
export function why(p: StarPuzzle, s: StarState): { text: string; cells: number[] } | null {
  const n = p.n;
  for (let i = 0; i < n * n; i++) {
    if (!s.dom[i]) return { text: `${cellName(n, i)} could be neither a star nor empty`, cells: [i] };
    if (isStar(s, i)) for (const j of around(n, i)) if (j > i && isStar(s, j)) return { text: `the stars in ${cellName(n, i)} and ${cellName(n, j)} would touch`, cells: [i, j] };
  }
  for (const u of unitsOf(p)) {
    const got = starsIn(s, u.cells);
    if (got > p.k) return { text: `${u.name} would have ${got} stars`, cells: u.cells };
    const m = p.k - got;
    if (m > 0 && room(n, openIn(s, u.cells), m) < m)
      return { text: `${u.name} would have no room left for its ${m === 1 && p.k > 1 ? "second star" : starWord(m)}`, cells: u.cells };
  }
  return null;
}
