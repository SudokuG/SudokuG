// Star Battle, solved the way a person does, step by step, easiest first: hints, rating and
// making puzzles of a size and level.
//
// Every cell keeps a mask of what is still possible: bit 0 = empty, bit 1 = star. A unit is
// a row, a column or a region; each needs k stars. The steps:
//   1. Around a Star (the cells around a star are empty), Full Unit (a unit with its stars:
//      the rest is empty), Last Cells (as many cells left as stars needed: all stars).
//   2. Shared Neighbour: a cell touching every cell left for a unit's last star is empty.
//      Confined Unit: a region whose open cells all lie in one row (or column) that needs as
//      many stars takes all of that line's stars, so the rest of the line is empty; and the
//      same with a line inside a region.
//   3. Squeeze: a star (or an empty cell) here would leave some unit without room for its
//      stars.
//   3.5-4 Region Groups: 2, 3 or 4 regions that fit inside as many lines (or lines inside
//      regions) take all their stars.
//   5. Trial: assume a star (or an empty cell); if the steps above then hit a contradiction,
//      it is the other way round.
//
// The state and units are in state.ts, the steps (1 to 4) in steps.ts; here the chains and
// trial, solving, rating and making.

import { cellName } from "../logic";
import type { LiteStep } from "../logic";
import { buildStars, randomStarPuzzle, touching } from "./engine";
import type { StarPuzzle } from "./engine";
import { FINDERS_1, FINDERS_2, aroundStar, colOf, fullUnit, lastCells, rowOf } from "./steps";
import type { Finder } from "./steps";
import { applyStep, cloneStars, isOpen, names, need, openIn, place, startState, unitsOf, why } from "./state";
import type { StarState } from "./state";

export { applyStep, place, startState, unitsOf } from "./state";
export type { StarState } from "./state";

function easiest(p: StarPuzzle, s: StarState, chains = true): LiteStep | "contradiction" | null {
  if (why(p, s)) return "contradiction";
  for (const f of p.k > 1 ? FINDERS_2 : FINDERS_1) {
    const st = f(p, s);
    if (st) return st;
  }
  return chains ? shortChain(p, s) : null;
}

const SIMPLE: Finder[] = [aroundStar, fullUnit, lastCells];

/**
 * Short Chain: assume a star (or an empty cell) and follow only the simplest steps (around a
 * star, full units, last cells), a few at most; if that already breaks something, it is
 * the other way round. What a person checks in their head before trying anything longer.
 */
function shortChain(p: StarPuzzle, s: StarState): LiteStep | null {
  const n = p.n;
  let best: { i: number; v: number; steps: LiteStep[]; reason: { text: string; cells: number[] } } | null = null;
  for (let i = 0; i < n * n; i++) {
    if (!isOpen(s, i)) continue;
    for (const v of [1, 0]) {
      const t = cloneStars(s);
      place(p, t, i, v);
      const steps: LiteStep[] = [];
      let reason = why(p, t);
      for (let k = 0; k < 6 && !reason; k++) {
        const st = SIMPLE.map((f) => f(p, t)).find(Boolean);
        if (!st) break;
        steps.push(st);
        applyStep(p, t, st);
        reason = why(p, t);
      }
      if (reason && (!best || steps.length < best.steps.length)) best = { i, v, steps, reason };
      if (best && best.steps.length <= 1) break;
    }
    if (best && best.steps.length <= 1) break;
  }
  if (!best) return null;
  const { i, v, steps, reason } = best;
  const name = cellName(n, i);
  const chain = chainOf(p, steps, reason);
  const said = chain.length ? `Then ${chain.join("; ")}; and then ${reason.text}.` : `Then at once ${reason.text}.`;
  return {
    technique: "Short Chain",
    level: 4,
    weight: 4 + 2 * steps.length,
    placements: [{ cell: i, value: v ? 0 : 1 }],
    eliminations: [],
    region: [i, ...reason.cells],
    nudge: `What would ${v ? "a star" : "an empty cell"} in ${name} lead to?`,
    explanation: `Suppose ${name} ${v ? "held a star" : "were empty"}. ${said} That can't be, so ${name} ${v ? "is empty" : "holds a star"}.`,
  };
}

const solved = (s: StarState) => s.placed.every(Boolean);

/**
 * The steps from an assumption to a contradiction, latest first while they matter: a
 * placement matters when it is in a cell the chain relies on, or touches one, or shares a
 * row, column or region with one.
 */
function chainOf(p: StarPuzzle, steps: LiteStep[], end: { text: string; cells: number[] }, max = 8): string[] {
  const n = p.n;
  const premise = new Set(end.cells);
  const out: string[] = [];
  const related = (a: number, b: number) => a === b || touching(n, a, b) || rowOf(n, a) === rowOf(n, b) || colOf(n, a) === colOf(n, b) || p.regionOf[a] === p.regionOf[b];
  for (let k = steps.length - 1; k >= 0; k--) {
    const st = steps[k];
    const used = st.placements.filter((pl) => [...premise].some((c) => related(c, pl.cell)));
    if (!used.length) continue;
    const stars = used.filter((pl) => pl.value);
    const gaps = used.filter((pl) => !pl.value);
    const parts: string[] = [];
    if (stars.length) parts.push(`${names(n, stars.map((x) => x.cell))} would ${stars.length === 1 ? "hold a star" : "hold stars"}`);
    if (gaps.length) parts.push(`${names(n, gaps.map((x) => x.cell))} would be empty`);
    out.unshift(`${parts.join(" and ")} (${st.technique.toLowerCase()})`);
    st.region.forEach((c) => premise.add(c));
    st.placements.forEach((pl) => premise.add(pl.cell));
  }
  return out.length > max ? ["…", ...out.slice(-max)] : out;
}

/**
 * Trial: assume a star (or an empty cell) and follow the easier steps; if that hits a
 * contradiction, the cell is the other way round. Of the first few that break, the one
 * with the shortest chain is shown.
 */
const trial = (p: StarPuzzle, s: StarState): LiteStep | null => {
  const n = p.n;
  // Cells of the units with the fewest open cells first: those are the easiest to try.
  const units = unitsOf(p)
    .filter((u) => need(p, s, u) > 0)
    .sort((a, b) => openIn(s, a.cells).length - openIn(s, b.cells).length);
  const cells = [...new Set(units.flatMap((u) => openIn(s, u.cells)))];
  let best: { i: number; v: number; chain: string[]; reason: { text: string; cells: number[] } } | null = null;
  let found = 0;
  search: for (const i of cells)
    for (const v of [1, 0]) {
      const t = cloneStars(s);
      place(p, t, i, v);
      const steps: LiteStep[] = [];
      let broken = false;
      for (let k = 0; k < 400 && !solved(t); k++) {
        const st = easiest(p, t, false);
        if (st === "contradiction") {
          broken = true;
          break;
        }
        if (!st) break;
        steps.push(st);
        applyStep(p, t, st);
      }
      if (!broken) continue;
      const reason = why(p, t) ?? { text: "the puzzle would break", cells: [] };
      const chain = chainOf(p, steps, reason);
      if (!best || chain.length < best.chain.length) best = { i, v, chain, reason };
      if (++found >= 4 || chain.length <= 2) break search;
    }
  if (!best) return null;
  const { i, v, chain, reason } = best;
  const name = cellName(n, i);
  const what = v ? "held a star" : "were empty";
  const said = chain.length ? `Then ${chain.join("; ")}; and then ${reason.text}.` : `Then at once ${reason.text}.`;
  return {
    technique: "Trial",
    level: 5,
    weight: 20,
    placements: [{ cell: i, value: v ? 0 : 1 }],
    eliminations: [],
    region: [i, ...reason.cells],
    nudge: `Try ${v ? "a star" : "an empty cell"} in ${name} and follow where it leads.`,
    explanation: `Suppose ${name} ${what}. ${said} That can't be, so ${name} ${v ? "is empty" : "holds a star"}.`,
  };
};

export function nextStep(p: StarPuzzle, s: StarState): LiteStep | null {
  const r = easiest(p, s);
  if (r === "contradiction") return null;
  return r ?? trial(p, s);
}

/** Solve step by step; at most `maxTrials` trial steps. */
export function logicSolveStars(p: StarPuzzle, from: StarState = startState(p), maxTrials = 3): { steps: LiteStep[]; solved: boolean } {
  const s = cloneStars(from);
  const steps: LiteStep[] = [];
  let trials = 0;
  for (let k = 0; k < 1000 && !solved(s); k++) {
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

export const STAR_LEVELS = ["Easy", "Medium", "Hard", "Expert"] as const;
export type StarLevel = (typeof STAR_LEVELS)[number];

/** Step totals per size: Medium above [0], Hard above [1], Expert above [2] (from the spread of random puzzles). */
export const STAR_CUTS: Record<number, [number, number, number]> = { 6: [8, 16, 30], 8: [10, 20, 40], 10: [45, 60, 85] };

/**
 * Rating, or null when it needs more than 3 trial steps. By the step total, within bounds
 * set by the hardest step: only the basic steps (and Squeeze, Blocks) make Easy or Medium;
 * Region Groups and Pair Blocks at least Medium; Short Chain at least Hard; Trial Expert.
 * With `plainOnly`, puzzles that need trial give null (quicker, for the easier levels).
 */
export function rateStars(p: StarPuzzle, plainOnly = false): { score: number; maxLevel: number; level: StarLevel } | null {
  const plain = logicSolveStars(p, startState(p), 0);
  const score = plain.steps.reduce((a, st) => a + st.weight, 0);
  const maxLevel = plain.steps.reduce((a, st) => Math.max(a, st.level), 0);
  if (plain.solved) {
    const cuts = STAR_CUTS[p.n] ?? STAR_CUTS[8];
    let k = cuts.filter((c) => score > c).length;
    if (maxLevel >= 4) k = Math.max(k, 2);
    else if (maxLevel >= 3.5) k = Math.min(Math.max(k, 1), 2);
    else k = Math.min(k, 1);
    return { score, maxLevel, level: STAR_LEVELS[k] };
  }
  if (plainOnly) return null;
  const t = logicSolveStars(p, startState(p), 3);
  return t.solved ? { score: t.steps.reduce((a, st) => a + st.weight, 0), maxLevel: 5, level: "Expert" } : null;
}

const p2skew = (n: number) => (n >= 9 ? 4 : 0);

/** Make a puzzle of a size and level (the closest found within the time budget). */
export function* makeStars(n: number, level: StarLevel, rnd: () => number, budgetMs = 5000): Generator<number, StarPuzzle> {
  const t0 = performance.now();
  const want = STAR_LEVELS.indexOf(level);
  let best: { p: StarPuzzle; miss: number } | null = null;
  for (let tries = 1; ; tries++) {
    // Two-star boards: let some regions stay small (more puzzles that need no trial).
    const p = randomStarPuzzle(n, rnd, p2skew(n));
    if (p) {
      const r = rateStars(p, level !== "Expert");
      if (r) {
        const miss = Math.abs(STAR_LEVELS.indexOf(r.level) - want);
        if (!miss) return p;
        if (!best || miss < best.miss) best = { p, miss };
      }
    }
    if (best && performance.now() - t0 > budgetMs) return best.p;
    yield tries;
  }
}

export { buildStars };

