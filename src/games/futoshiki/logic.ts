// Futoshiki, solved the way a person does, step by step, easiest first. Used for hints and
// for rating how hard a puzzle is.
//
// Every cell keeps a mask of the digits still possible (bit d = digit d). The steps:
//   1. Single (a cell with one digit left) and Hidden Single (a digit with one place left in
//      a row or column).
//   2. Sign: one sign narrows its two cells (the smaller one stays below the largest digit
//      still possible on the other side, and the other way round).
//   3. Pair: two cells in a line with the same two digits left (those digits leave the rest
//      of the line), or two digits with the same two places left (other digits leave those
//      cells). 3.5 Triple: the same with three.
//   5. Trial: assume a digit; if the steps above then run into a contradiction, it can go.

import { bitsOf, cellName, describeEliminations, listJoin, onlyBit, popcount } from "../logic";
import type { CellValue, LiteStep } from "../logic";
import { shuffle } from "../latin";
import { cloneLatin, hiddenSingle, placeLatin, single, subsets } from "../latin-steps";
import type { LatinState } from "../latin-steps";
import { generateFutoshiki, inequalities, pairsOf } from "./engine";
import type { FutoshikiPuzzle } from "./engine";

export type FutoState = LatinState;

export function startState(p: FutoshikiPuzzle): FutoState {
  const all = ((1 << (p.n + 1)) - 1) & ~1;
  const s: FutoState = { dom: new Array(p.n * p.n).fill(all), placed: new Array(p.n * p.n).fill(false) };
  p.givens.forEach((g, i) => g && place(p, s, i, p.solution[i]));
  return s;
}

const cloneState = cloneLatin;
export const place = (p: FutoshikiPuzzle, s: FutoState, cell: number, v: number) => placeLatin(p, s, cell, v);

export function applyStep(p: FutoshikiPuzzle, s: FutoState, step: LiteStep): void {
  for (const e of step.eliminations) s.dom[e.cell] &= ~(1 << e.value);
  for (const pl of step.placements) place(p, s, pl.cell, pl.value);
}

type Finder = (p: FutoshikiPuzzle, s: FutoState) => LiteStep | "contradiction" | null;

const highest = (m: number) => 31 - Math.clz32(m);
const lowest = (m: number) => 31 - Math.clz32(m & -m);

const sign: Finder = (p, s) => {
  const n = p.n;
  for (const [a, b] of inequalities(p)) {
    // a < b
    const na = s.dom[a] & ((1 << highest(s.dom[b])) - 1);
    const nb = s.dom[b] & ~((1 << (lowest(s.dom[a]) + 1)) - 1);
    if (!na || !nb) return "contradiction";
    if (na === s.dom[a] && nb === s.dom[b]) continue;
    const elims: CellValue[] = [
      ...bitsOf(s.dom[a] & ~na).map((value) => ({ cell: a, value })),
      ...bitsOf(s.dom[b] & ~nb).map((value) => ({ cell: b, value })),
    ];
    const A = cellName(n, a);
    const B = cellName(n, b);
    const vals = (m: number) => listJoin(bitsOf(m).map(String)).replace(/ and /g, " or ");
    const why: string[] = [];
    const parts: { elims: CellValue[]; text: string; premise: number[] }[] = [];
    const hb = highest(s.dom[b]);
    const la = lowest(s.dom[a]);
    if (na !== s.dom[a]) {
      why.push(`${A} must be smaller than ${B}, which is at most ${hb}, so ${A} can't be ${vals(s.dom[a] & ~na)}`);
      parts.push({ elims: elims.filter((e) => e.cell === a), premise: hb < n ? [b] : [], text: `${A} < ${B}${hb < n ? ` (at most ${hb})` : ""}, so ${A} isn't ${vals(s.dom[a] & ~na)}` });
    }
    if (nb !== s.dom[b]) {
      why.push(`${B} must be larger than ${A}, which is at least ${la}, so ${B} can't be ${vals(s.dom[b] & ~nb)}`);
      parts.push({ elims: elims.filter((e) => e.cell === b), premise: la > 1 ? [a] : [], text: `${B} > ${A}${la > 1 ? ` (at least ${la})` : ""}, so ${B} isn't ${vals(s.dom[b] & ~nb)}` });
    }
    return {
      technique: "Sign",
      level: 2,
      weight: 1,
      placements: [],
      eliminations: elims,
      region: [a, b],
      nudge: `Look at the sign between ${A} and ${B}.`,
      explanation: `The sign between ${A} and ${B} points at ${A}: ${why.join("; and ")}.`,
      parts,
    };
  }
  return null;
};

const FINDERS: Finder[] = [single, hiddenSingle, sign, subsets(2), subsets(3)];

function easiest(p: FutoshikiPuzzle, s: FutoState): LiteStep | "contradiction" | null {
  for (const f of FINDERS) {
    const r = f(p, s);
    if (r) return r;
  }
  return null;
}

const solved = (s: FutoState) => s.placed.every(Boolean);

function propagate(p: FutoshikiPuzzle, s: FutoState): "solved" | "stuck" | "contradiction" {
  for (let k = 0; k < 600; k++) {
    if (solved(s)) return "solved";
    const st = easiest(p, s);
    if (st === "contradiction") return "contradiction";
    if (!st) return "stuck";
    applyStep(p, s, st);
  }
  return "stuck";
}

function trial(p: FutoshikiPuzzle, s: FutoState): LiteStep | null {
  const cells = s.dom.map((d, i) => [i, popcount(d)]).filter(([i, k]) => !s.placed[i] && k > 1).sort((a, b) => a[1] - b[1]);
  for (const [i] of cells)
    for (const v of bitsOf(s.dom[i])) {
      const t = cloneState(s);
      place(p, t, i, v);
      if (propagate(p, t) === "contradiction") {
        const name = cellName(p.n, i);
        return {
          technique: "Trial",
          level: 5,
          weight: 20,
          placements: [],
          eliminations: [{ cell: i, value: v }],
          region: [i],
          nudge: `Try a digit in ${name} and follow where it leads.`,
          explanation: `Suppose ${name} were ${v}. Following the easier steps from there runs into a contradiction, so ${name} isn't ${v}.`,
          parts: [{ elims: [{ cell: i, value: v }], text: `trying ${v} in ${name} leads to a contradiction, so ${name} isn't ${v}` }],
        };
      }
    }
  return null;
}

export function nextStep(p: FutoshikiPuzzle, s: FutoState): LiteStep | null {
  const r = easiest(p, s);
  if (r === "contradiction") return null;
  return r ?? trial(p, s);
}

/** Solve step by step; at most `maxTrials` trial steps (0: stop where trial would be needed). */
export function logicSolveFutoshiki(p: FutoshikiPuzzle, from: FutoState = startState(p), maxTrials = 3): { steps: LiteStep[]; solved: boolean; state: FutoState } {
  const s = cloneState(from);
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
  return { steps, solved: solved(s), state: s };
}

export const FUTO_LEVELS = ["Easy", "Medium", "Hard", "Expert"] as const;
export type FutoLevel = (typeof FUTO_LEVELS)[number];

/** Step totals per size: Medium above [0], Hard above [1] (pairs and triples count too). */
export const FUTO_CUTS: Record<number, [number, number]> = { 5: [11, 16], 6: [19, 28], 7: [34, 47] };

/**
 * Rating, or null when it needs more than 3 trial steps. Without trial: Easy, Medium or Hard
 * by the step total and the hardest technique (pairs make it at least Medium, triples Hard);
 * with up to 3 trial steps: Expert.
 */
export function rateFutoshiki(p: FutoshikiPuzzle, allowTrial = true): { score: number; maxLevel: number; level: FutoLevel } | null {
  const plain = logicSolveFutoshiki(p, startState(p), 0);
  const score = plain.steps.reduce((a, st) => a + st.weight, 0);
  const maxLevel = plain.steps.reduce((a, st) => Math.max(a, st.level), 0);
  if (plain.solved) {
    const cuts = FUTO_CUTS[p.n] ?? FUTO_CUTS[6];
    const level: FutoLevel = maxLevel >= 3.5 || score > cuts[1] ? "Hard" : maxLevel >= 3 || score > cuts[0] ? "Medium" : "Easy";
    return { score, maxLevel, level };
  }
  if (!allowTrial) return { score: Infinity, maxLevel: 5, level: "Expert" };
  const t = logicSolveFutoshiki(p, startState(p), 3);
  return t.solved ? { score: t.steps.reduce((a, st) => a + st.weight, 0), maxLevel: 5, level: "Expert" } : null;
}

/**
 * A puzzle of a size and level, with no clue it doesn't need.
 *   1. A minimal puzzle: as few signs and digits as keep one solution.
 *   2. Expert: kept when it needs trial (at most 3 times). Easier levels: while it is harder
 *      than asked, a clue is added where the solve gets stuck (a sign next to an open cell,
 *      or now and then a digit).
 *   3. Trim: every clue whose removal keeps the puzzle at the same level goes (signs and
 *      digits in random order). What is left all helps.
 * Yields between tries; after `budgetMs` it takes the closest.
 */
export function* makeFutoshiki(n: number, level: FutoLevel, rnd: () => number, budgetMs = 5000): Generator<number, FutoshikiPuzzle> {
  const t0 = performance.now();
  const want = FUTO_LEVELS.indexOf(level);
  let best: { p: FutoshikiPuzzle; miss: number } | null = null;
  const pairs = pairsOf(n);
  const keep = (p: FutoshikiPuzzle, miss: number) => {
    if (!best || miss < best.miss) best = { p: { ...p, givens: p.givens.slice(), signs: p.signs.slice() }, miss };
  };
  for (let tries = 1; ; tries++) {
    const p = generateFutoshiki(n, rnd, 0);
    if (level === "Expert") {
      const r = rateFutoshiki(p, true);
      // A minimal puzzle has no clue to spare already.
      if (r?.level === "Expert") return p;
      keep(p, r ? want - FUTO_LEVELS.indexOf(r.level) : 1);
    } else {
      for (let extra = 0; extra < 4 * n; extra++) {
        const plain = logicSolveFutoshiki(p, startState(p), 0);
        const got = FUTO_LEVELS.indexOf(rateFutoshiki(p, false)!.level);
        keep(p, Math.abs(got - want));
        if (got === want) {
          yield tries;
          yield* trim(p, level, rnd);
          return p;
        }
        if (got < want) break; // easier than asked: start from a new minimal puzzle
        // Add clues where the solve got stuck: one per level too hard (the trim takes back any extra).
        const st = plain.state;
        const open = (c: number) => !st.placed[c];
        let added = 0;
        for (let k = 0; k < got - want; k++) {
          const signs = [...pairs.keys()].filter((j) => !p.signs[j] && (open(pairs[j][0]) || open(pairs[j][1])));
          const cells = [...Array(n * n).keys()].filter((i) => !p.givens[i] && open(i));
          if (signs.length && (rnd() < 0.8 || !cells.length)) p.signs[signs[Math.floor(rnd() * signs.length)]] = true;
          else if (cells.length) p.givens[cells[Math.floor(rnd() * cells.length)]] = true;
          else break;
          added++;
        }
        if (!added) break;
      }
    }
    if (best && performance.now() - t0 > budgetMs) {
      // Out of time: the closest one, trimmed at the level it has.
      const q = (best as { p: FutoshikiPuzzle }).p;
      const got = rateFutoshiki(q, false)!.level;
      if (got !== "Expert") yield* trim(q, got, rnd);
      return q;
    }
    yield tries;
  }
}

/**
 * Take away every clue the puzzle can do without at its level, in random order, pass after
 * pass until none can go (taking one away can make another unnecessary). Yields now and then.
 */
function* trim(p: FutoshikiPuzzle, level: FutoLevel, rnd: () => number): Generator<number, void> {
  let since = performance.now();
  for (let removed = true; removed; ) {
    removed = false;
    const signs = p.signs.map((on, k) => (on ? k : -1)).filter((k) => k >= 0);
    const cells = p.givens.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
    const clues = shuffle([...signs.map((k) => ({ sign: k })), ...cells.map((i) => ({ cell: i }))], rnd);
    for (const c of clues) {
      if ("sign" in c) p.signs[c.sign] = false;
      else p.givens[c.cell] = false;
      if (rateFutoshiki(p, false)!.level === level) removed = true;
      else if ("sign" in c) p.signs[c.sign] = true;
      else p.givens[c.cell] = true;
      if (performance.now() - since > 25) {
        yield 0;
        since = performance.now();
      }
    }
  }
}
