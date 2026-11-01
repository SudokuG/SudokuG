// Calcudoku, solved the way a person does, step by step, easiest first: hints, rating and
// making puzzles of a size and level.
//
// Every cell keeps a mask of the digits still possible (bit d = digit d). The steps:
//   1. Single, Hidden Single (as in any Latin square).
//   2. Cage Options: every way to fill one cage with digits still possible (meeting its
//      target, no repeats in a row or column); what no way uses can go. Up to 3 ways: level 2.
//   3. Naked / Hidden Pair; Cage Options with more ways (level 3).
//   3.5 Must-Have Digit: a digit every way of a cage uses, always in the same row or column,
//      leaves the rest of that line. Naked / Hidden Triple.
//   5. Trial: assume a digit; if the steps above then hit a contradiction, it can go.

import { randomLatin } from "../latin";
import { cloneLatin, hiddenSingle, latinTrial, latinWhy, linesOf, placeLatin, single, subsets, xWing } from "../latin-steps";
import type { LatinState } from "../latin-steps";
import { bitsOf, cellName, describeEliminations, listJoin, popcount } from "../logic";
import type { CellValue, LiteStep } from "../logic";
import { meets, randomCages } from "./engine";
import type { CalcPuzzle, Cage } from "./engine";

export type CalcState = LatinState;

export function startState(p: CalcPuzzle): CalcState {
  const all = ((1 << (p.n + 1)) - 1) & ~1;
  const s: CalcState = { dom: new Array(p.n * p.n).fill(all), placed: new Array(p.n * p.n).fill(false) };
  p.givens.forEach((g, i) => g && placeLatin(p, s, i, p.solution[i]));
  return s;
}

export const place = (p: CalcPuzzle, s: CalcState, cell: number, v: number) => placeLatin(p, s, cell, v);

export function applyStep(p: CalcPuzzle, s: CalcState, step: LiteStep): void {
  for (const e of step.eliminations) s.dom[e.cell] &= ~(1 << e.value);
  for (const pl of step.placements) place(p, s, pl.cell, pl.value);
}

type Finder = (p: CalcPuzzle, s: CalcState) => LiteStep | "contradiction" | null;

/** "the 12× cage at r1c1" */
export const cageName = (p: CalcPuzzle, c: Cage) => `the ${c.target}${c.op === "=" ? "" : c.op} cage at ${cellName(p.n, Math.min(...c.cells))}`;

/** Every way to fill a cage with digits still possible: lists of digits in the order of its cells. */
export function cageWays(p: CalcPuzzle, s: CalcState, c: Cage, limit = 5000): number[][] {
  const n = p.n;
  const cells = c.cells;
  const out: number[][] = [];
  const v: number[] = [];
  const clash = (k: number, d: number) => {
    for (let j = 0; j < k; j++) {
      const a = cells[j];
      const b = cells[k];
      if (v[j] === d && (Math.floor(a / n) === Math.floor(b / n) || a % n === b % n)) return true;
    }
    return false;
  };
  const go = (k: number, acc: number): void => {
    if (out.length >= limit) return;
    if (k === cells.length) {
      if (meets(c, v)) out.push(v.slice());
      return;
    }
    for (const d of bitsOf(s.dom[cells[k]])) {
      if (clash(k, d)) continue;
      // Cut early: a sum can't pass the target, a product must divide it.
      if (c.op === "+" && acc + d > c.target) continue;
      if (c.op === "×" && c.target % (acc * d) !== 0) continue;
      v[k] = d;
      go(k + 1, c.op === "+" ? acc + d : c.op === "×" ? acc * d : acc);
    }
  };
  go(0, c.op === "×" ? 1 : 0);
  return out;
}

/** "1+5 or 2+4" (the different sets of digits a cage can hold). */
function waysText(c: Cage, ways: number[][]): string {
  const sym = c.op === "=" ? "" : c.op;
  const sets = [...new Set(ways.map((w) => [...w].sort((a, b) => (c.op === "−" || c.op === "÷" ? b - a : a - b)).join(sym)))];
  return sets.length <= 4 ? listJoin(sets).replace(/ and ([^ ]+)$/, " or $1") : `${sets.length} different sets of digits`;
}

const cageStep =
  (maxWays: number): Finder =>
  (p, s) => {
    let best: { c: Cage; ways: number[][]; elims: CellValue[] } | null = null;
    for (const c of p.cages) {
      if (c.cells.every((i) => s.placed[i])) continue;
      const ways = cageWays(p, s, c);
      if (!ways.length) return "contradiction";
      if (ways.length > maxWays) continue;
      const elims: CellValue[] = [];
      c.cells.forEach((cell, k) => {
        const used = ways.reduce((m, w) => m | (1 << w[k]), 0);
        for (const d of bitsOf(s.dom[cell] & ~used)) elims.push({ cell, value: d });
      });
      if (elims.length && (!best || ways.length < best.ways.length)) best = { c, ways, elims };
    }
    if (!best) return null;
    const { c, ways, elims } = best;
    const name = cageName(p, c);
    const simple = ways.length <= 3;
    const fills = waysText(c, ways);
    const Name = name[0].toUpperCase() + name.slice(1);
    return {
      technique: "Cage Options",
      level: simple ? 2 : 3,
      weight: (simple ? 1 : 2) + Math.min(ways.length, 12) / 4,
      placements: [],
      eliminations: elims,
      region: c.cells,
      nudge: `Look at ${name}: which digits can it hold?`,
      explanation: `${Name} can only be ${fills} (with the digits still possible, and no digit twice in a row or column). So ${describeEliminations(p.n, elims)}.`,
      parts: c.cells
        .map((cell) => ({ cell, gone: elims.filter((e) => e.cell === cell) }))
        .filter((x) => x.gone.length)
        .map((x) => ({
          elims: x.gone,
          premise: c.cells.filter((j) => j !== x.cell),
          text: `${name} can only be ${fills}, so ${cellName(p.n, x.cell)} isn't ${listJoin(x.gone.map((e) => String(e.value))).replace(/ and /g, " or ")}`,
        })),
    };
  };

/** A digit every way of a cage uses, always in one row or column: it leaves the rest of that line. */
const mustHave: Finder = (p, s) => {
  const n = p.n;
  for (const c of p.cages) {
    if (c.cells.length < 2 || c.cells.every((i) => s.placed[i])) continue;
    const ways = cageWays(p, s, c);
    if (!ways.length) return "contradiction";
    for (let d = 1; d <= n; d++) {
      if (!ways.every((w) => w.includes(d))) continue;
      const at = new Set<number>();
      for (const w of ways) w.forEach((x, k) => x === d && at.add(c.cells[k]));
      for (const line of linesOf(n)) {
        if (![...at].every((i) => line.cells.includes(i))) continue;
        const elims = line.cells.filter((i) => !c.cells.includes(i) && !s.placed[i] && s.dom[i] & (1 << d)).map((cell) => ({ cell, value: d }));
        if (!elims.length) continue;
        const name = cageName(p, c);
        return {
          technique: "Must-Have Digit",
          level: 3.5,
          weight: 5,
          placements: [],
          eliminations: elims,
          region: [...c.cells, ...line.cells.filter((i) => !c.cells.includes(i))],
          nudge: `${name[0].toUpperCase()}${name.slice(1)} needs a certain digit somewhere in ${line.name}.`,
          explanation: `Every way to fill ${name} (${waysText(c, ways)}) uses a ${d}, and always in ${line.name}. So the ${d} of ${line.name} is in that cage: ${describeEliminations(n, elims)}.`,
          parts: [{ elims, premise: c.cells, text: `${name} always has a ${d} in ${line.name}, so ${listJoin(elims.map((e) => cellName(n, e.cell)))} ${elims.length === 1 ? "isn't" : "aren't"} ${d}` }],
        };
      }
    }
  }
  return null;
};

const FINDERS: Finder[] = [single, hiddenSingle, cageStep(3), subsets(2), cageStep(Infinity), mustHave, subsets(3), xWing];

function easiest(p: CalcPuzzle, s: CalcState): LiteStep | "contradiction" | null {
  for (const f of FINDERS) {
    const r = f(p, s);
    if (r) return r;
  }
  return null;
}

const solved = (s: CalcState) => s.placed.every(Boolean);

/** Why a state can't be right: the Latin-square reasons, or a cage that can no longer be filled. */
function why(p: CalcPuzzle, s: CalcState): { text: string; cells: number[] } | null {
  const w = latinWhy(p, s);
  if (w) return w;
  for (const c of p.cages) if (!cageWays(p, s, c, 1).length) return { text: `${cageName(p, c)} could no longer be filled`, cells: c.cells };
  return null;
}

const trial = (p: CalcPuzzle, s: CalcState) => latinTrial(p, s, easiest, applyStep, why);

export function nextStep(p: CalcPuzzle, s: CalcState): LiteStep | null {
  const r = easiest(p, s);
  if (r === "contradiction") return null;
  return r ?? trial(p, s);
}

/** Solve step by step; at most `maxTrials` trial steps. */
export function logicSolveCalc(p: CalcPuzzle, from: CalcState = startState(p), maxTrials = 3): { steps: LiteStep[]; solved: boolean } {
  const s = cloneLatin(from);
  const steps: LiteStep[] = [];
  let trials = 0;
  for (let k = 0; k < 800 && !solved(s); k++) {
    const e = easiest(p, s);
    let st = e === "contradiction" ? null : e;
    if (!st && e !== "contradiction" && trials < maxTrials) {
      st = trial(p, s);
      trials++;
    }
    if (!st) break;
    steps.push(st);
    applyStep(p, s, st);
  }
  return { steps, solved: solved(s) };
}

export const CALC_LEVELS = ["Easy", "Medium", "Hard", "Expert"] as const;
export type CalcLevel = (typeof CALC_LEVELS)[number];

/** Step totals per size: Medium above [0], Hard above [1] (set from the spread of random puzzles). */
export const CALC_CUTS: Record<number, [number, number]> = { 5: [9, 23], 6: [20, 46], 7: [35, 48] };

/**
 * Rating, or null when it needs more than 3 trial steps (or has more than one solution).
 * Without trial: Easy, Medium or Hard by the step total and the hardest step (pairs and
 * crowded cages make it at least Medium, triples and must-have digits Hard); with trial: Expert.
 * With `plainOnly`, puzzles that need trial give null (quicker, for the easier levels).
 */
export function rateCalc(p: CalcPuzzle, plainOnly = false): { score: number; maxLevel: number; level: CalcLevel } | null {
  const plain = logicSolveCalc(p, startState(p), 0);
  const score = plain.steps.reduce((a, st) => a + st.weight, 0);
  const maxLevel = plain.steps.reduce((a, st) => Math.max(a, st.level), 0);
  if (plain.solved) {
    const cuts = CALC_CUTS[p.n] ?? CALC_CUTS[6];
    const level: CalcLevel = maxLevel >= 3.5 || score > cuts[1] ? "Hard" : maxLevel >= 3 || score > cuts[0] ? "Medium" : "Easy";
    return { score, maxLevel, level };
  }
  if (plainOnly) return null;
  const t = logicSolveCalc(p, startState(p), 3);
  return t.solved ? { score: t.steps.reduce((a, st) => a + st.weight, 0), maxLevel: 5, level: "Expert" } : null;
}

/** Cage sizes per level (weights for sizes 0..5): easier puzzles have smaller cages. */
const SIZE_WEIGHTS: Record<CalcLevel, number[]> = {
  Easy: [0, 0.12, 0.55, 0.28, 0.05],
  Medium: [0, 0.07, 0.48, 0.33, 0.12],
  Hard: [0, 0.04, 0.4, 0.38, 0.18],
  Expert: [0, 0.02, 0.34, 0.4, 0.2, 0.04],
};
/** On 7×7 boards other mixes hit Easy and Expert far more often (measured on samples). */
const SIZE_WEIGHTS_7: Partial<Record<CalcLevel, number[]>> = {
  Easy: [0, 0.16, 0.6, 0.22, 0.02],
  Expert: [0, 0.08, 0.5, 0.32, 0.1],
};

/**
 * A puzzle of a size and level, made on the spot: random cages on a random Latin square,
 * kept when the steps solve it (so it has one solution) at the asked level. Yields between
 * tries; after `budgetMs` it takes the closest.
 */
export function* makeCalc(n: number, level: CalcLevel, rnd: () => number, budgetMs = 4000): Generator<number, CalcPuzzle> {
  const t0 = performance.now();
  const want = CALC_LEVELS.indexOf(level);
  let best: { p: CalcPuzzle; miss: number } | null = null;
  for (let tries = 1; ; tries++) {
    const solution = randomLatin(n, rnd).map((v) => v + 1);
    const p = randomCages(n, solution, rnd, (n === 7 && SIZE_WEIGHTS_7[level]) || SIZE_WEIGHTS[level]);
    const r = rateCalc(p, level !== "Expert");
    if (r) {
      const miss = Math.abs(CALC_LEVELS.indexOf(r.level) - want);
      if (!miss) return p;
      if (!best || miss < best.miss) best = { p, miss };
    }
    if (best && performance.now() - t0 > budgetMs) return best.p;
    yield tries;
  }
}

