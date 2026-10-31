// Treasure Map, solved the way a person does: step by step, easiest step first. Used for
// hints and for rating how hard a puzzle is (how big the map is matters much less than
// what you have to work out on it).
//
// Every cell keeps a mask of what is still possible (bit 0 = X, bit d = digit d). What makes
// a step hard is mostly what you need to keep track of. On paper you see the placed digits
// and the cells you know are (or can't be) an X; candidate digits you only have if you
// write them down. So the steps come in two kinds:
//   With what you can see (placed digits, X or not-X):
//     1. Single, Hidden Single, Last X's (a line has just enough places left for its X's).
//     2. Clue X's: one line's clue (every way to put its two X's and split the digits into
//        groups adding up to the clue) shows where an X must or can't be, or fixes a cell.
//        Few ways (up to 4) is level 2, more is level 3.
//   With candidates written down:
//     3. Candidate Single: a single that needs the candidates.
//     4. Clue Groups: the same line reasoning using the candidates (which also rules out
//        digits); 4.5 Line Arrangements: with the order of the digits inside the groups.
//     5. Trial: assume a possibility; if the steps above then run into a contradiction, it
//        can go.

import { bitsOf, cellName, listJoin, onlyBit, popcount, valueName } from "../logic";
import type { CellValue, LiteStep } from "../logic";
import { cluesOf, randomGrid } from "./engine";
import type { SumsPuzzle } from "./engine";

export interface SumsState {
  dom: number[];
  placed: boolean[];
}

interface Shape {
  /** Positions (in the line) of the two X's. */
  xs: number[];
  /** The groups of digits: [start, length]. */
  runs: [number, number][];
  /** Ways to split the digits: one digit mask per group (bit d = digit d). */
  parts: number[][];
}

interface Line {
  name: string;
  cells: number[];
  clue: number[];
  shapes: Shape[];
}

// ---------------------------------------------------------------------------
// Lines and their possible shapes, worked out once per puzzle

const subsetCache = new Map<number, Map<string, number[]>>();
/** Digit sets of 1..m by size and sum: key "size,sum" -> masks. */
function subsets(m: number): Map<string, number[]> {
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

const lineCache = new WeakMap<SumsPuzzle, Line[]>();
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

// ---------------------------------------------------------------------------
// State

/** The state at the start: everything possible, givens placed. */
export function startState(p: SumsPuzzle): SumsState {
  const all = (1 << (p.n - 1)) - 1; // bits 0..n-2: X and digits 1..n-2
  const s: SumsState = { dom: new Array(p.n * p.n).fill(all), placed: new Array(p.n * p.n).fill(false) };
  p.givens.forEach((g, i) => g && place(p, s, i, p.solution[i]));
  return s;
}

const cloneState = (s: SumsState): SumsState => ({ dom: s.dom.slice(), placed: s.placed.slice() });

/**
 * What you can see in a cell without written candidates: a placed value, or the digits not
 * yet placed in its row and column, plus X if it isn't ruled out.
 */
function seen(p: SumsPuzzle, s: SumsState): number[] {
  const n = p.n;
  const digits = ((1 << (n - 1)) - 1) & ~1;
  const rowUsed = new Array(n).fill(0);
  const colUsed = new Array(n).fill(0);
  for (let i = 0; i < n * n; i++)
    if (s.placed[i] && s.dom[i] !== 1) {
      rowUsed[Math.floor(i / n)] |= s.dom[i];
      colUsed[i % n] |= s.dom[i];
    }
  return s.dom.map((d, i) => (s.placed[i] ? d : (d & 1) | (digits & ~rowUsed[Math.floor(i / n)] & ~colUsed[i % n])));
}

/** Place a value; a digit leaves the rest of its row and column, two X's close a line to X's. */
export function place(p: SumsPuzzle, s: SumsState, cell: number, v: number): void {
  const n = p.n;
  s.dom[cell] = 1 << v;
  s.placed[cell] = true;
  const r = Math.floor(cell / n);
  const c = cell % n;
  const row = Array.from({ length: n }, (_, k) => r * n + k);
  const col = Array.from({ length: n }, (_, k) => k * n + c);
  for (const line of [row, col]) {
    if (v > 0) for (const j of line) if (j !== cell) s.dom[j] &= ~(1 << v);
    if (v === 0 && line.filter((j) => s.placed[j] && s.dom[j] === 1).length === 2) for (const j of line) if (!(s.placed[j] && s.dom[j] === 1)) s.dom[j] &= ~1;
  }
}

export function applyStep(p: SumsPuzzle, s: SumsState, step: LiteStep): void {
  for (const e of step.eliminations) s.dom[e.cell] &= ~(1 << e.value);
  for (const pl of step.placements) place(p, s, pl.cell, pl.value);
}

// ---------------------------------------------------------------------------
// The steps

type Finder = (p: SumsPuzzle, s: SumsState) => LiteStep | "contradiction" | null;

const singles = (useCands: boolean): Finder => (p, s) => {
  const dom = useCands ? s.dom : seen(p, s);
  for (let i = 0; i < dom.length; i++) {
    if (!dom[i]) return "contradiction";
    if (!s.placed[i] && popcount(dom[i]) === 1) {
      const v = onlyBit(dom[i]);
      const name = cellName(p.n, i);
      return {
        technique: useCands ? "Candidate Single" : "Single",
        level: useCands ? 3 : 1,
        weight: useCands ? 7 : 0,
        placements: [{ cell: i, value: v }],
        eliminations: [],
        region: [i],
        nudge: `One cell has only one possibility left.`,
        explanation: useCands
          ? `With the candidates worked out so far, ${name} has only one possibility left: ${v ? v : "an X"}.`
          : `${name} ${v ? "can't be an X, and" : ""} ${v ? `every other digit is already in its row or column, so it is ${v}` : "can't hold any digit that's still missing from its row and column, so it is an X"}.`.replace("  ", " "),
      };
    }
  }
  return null;
};

const hiddenSingles = (useCands: boolean): Finder => (p, s) => {
  const m = p.n - 2;
  const dom = useCands ? s.dom : seen(p, s);
  for (const line of linesOf(p)) {
    for (let d = 1; d <= m; d++) {
      const at = line.cells.filter((c) => dom[c] & (1 << d));
      if (!at.length) return "contradiction";
      if (at.length === 1 && !s.placed[at[0]])
        return {
          technique: useCands ? "Candidate Single" : "Hidden Single",
          level: useCands ? 3 : 1,
          weight: useCands ? 7 : 0,
          placements: [{ cell: at[0], value: d }],
          eliminations: [],
          region: line.cells,
          nudge: `Look for a digit with only one place left in ${line.name}.`,
          explanation: useCands
            ? `With the candidates worked out so far, the ${d} in ${line.name} can only go in ${cellName(p.n, at[0])}.`
            : `In ${line.name}, the ${d} can only go in ${cellName(p.n, at[0])}: the other cells are filled, are X's, or see a ${d} in their column or row.`,
        };
    }
    if (useCands) continue; // the X's need no candidates: done in the version without
    const placedX = line.cells.filter((c) => s.placed[c] && s.dom[c] === 1).length;
    const open = line.cells.filter((c) => !s.placed[c] && s.dom[c] & 1);
    const need = 2 - placedX;
    if (open.length < need) return "contradiction";
    if (need > 0 && open.length === need)
      return {
        technique: "Last X's",
        level: 1,
        weight: 0,
        placements: open.map((cell) => ({ cell, value: 0 })),
        eliminations: [],
        region: line.cells,
        nudge: `${line.name[0].toUpperCase()}${line.name.slice(1)} has just enough places left for its X's.`,
        explanation: `${line.name[0].toUpperCase()}${line.name.slice(1)} still needs ${need === 1 ? "one X" : "two X's"}, and only ${listJoin(open.map((c) => cellName(p.n, c)))} can still hold one.`,
      };
  }
  return null;
};

const setName = (mask: number) => `{${bitsOf(mask).join(",")}}`;

/** All ways (X positions and digit groups) a line can still be filled; the union per cell. */
function lineWays(all: number[], line: Line): { ways: number; union: number[]; examples: string[] } {
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
function lineArrangements(all: number[], line: Line): { ways: number; union: number[] } {
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
const staticWays = (line: Line) => line.shapes.reduce((a, sh) => a + sh.parts.length, 0);

/** What a line step concludes, in words: "r3c1 is an X; r3c4 can only be 2 or 3". */
function conclusions(n: number, line: Line, s: SumsState, union: number[], xOnly = false): string {
  const parts: string[] = [];
  line.cells.forEach((c, k) => {
    const before = s.dom[c];
    const after = before & union[k];
    if (after === before || s.placed[c]) return;
    if (xOnly && popcount(after) !== 1 && !(before & 1 && !(after & 1))) return;
    const name = cellName(n, c);
    if (popcount(after) === 1) parts.push(`${name} ${after === 1 ? "is an X" : `is ${onlyBit(after)}`}`);
    else if (xOnly || (before & 1 && !(after & 1) && (after | 1) === before)) parts.push(`${name} is not an X`);
    else parts.push(`${name} can only be ${listJoin(bitsOf(after).map(valueName)).replace(/ and /g, " or ")}`);
  });
  return listJoin(parts);
}

/**
 * Line reasoning. Without candidates (`useCands` false) it works from what you can see and
 * only keeps what you'd note on paper: X or not-X, and cells it fixes. With candidates it
 * keeps every elimination. `full` also tries the order of the digits inside the groups.
 */
function lineStep(p: SumsPuzzle, s: SumsState, useCands: boolean, full: boolean): LiteStep | "contradiction" | null {
  const view = useCands ? s.dom : seen(p, s);
  let best: { line: Line; ways: number; union: number[]; examples: string[]; elims: CellValue[]; placements: CellValue[] } | null = null;
  for (const line of linesOf(p)) {
    const r = full ? { ...lineArrangements(view, line), examples: [] as string[] } : lineWays(view, line);
    if (!r.ways) return "contradiction";
    const elims: CellValue[] = [];
    const placements: CellValue[] = [];
    line.cells.forEach((c, k) => {
      if (s.placed[c]) return;
      const after = view[c] & r.union[k];
      if (useCands) {
        for (const b of bitsOf(s.dom[c] & ~r.union[k])) elims.push({ cell: c, value: b });
      } else if (popcount(after) === 1) {
        placements.push({ cell: c, value: onlyBit(after) });
      } else if (s.dom[c] & 1 && !(r.union[k] & 1)) {
        elims.push({ cell: c, value: 0 });
      }
    });
    if ((elims.length || placements.length) && (!best || r.ways < best.ways)) best = { line, ...r, elims, placements };
  }
  if (!best) return null;
  const { line, ways, union, examples, elims, placements } = best;
  const n = p.n;
  const Name = line.name[0].toUpperCase() + line.name.slice(1);
  const clue = line.clue.join(" ");
  const what = conclusions(n, line, { dom: view, placed: s.placed }, union, !useCands);
  const sums = line.clue.length > 1 ? listJoin(line.clue.map(String)) : clue;
  if (full)
    return {
      technique: "Line Arrangements",
      level: 4.5,
      weight: 14 + Math.log2(ways + 1),
      placements: [],
      eliminations: elims,
      region: line.cells,
      nudge: `Try the possible orders of the digits in ${line.name} (clue ${clue}).`,
      explanation: `${Name} has the clue ${clue}. Counting the order of the digits inside each group too, ${ways === 1 ? "only one arrangement fits" : `${ways} arrangements fit`} the candidates. In ${ways === 1 ? "it" : "all of them"}, ${what}.`,
    };
  const list = ways <= 3 ? ` ${ways === 1 ? "The only one:" : "They are:"} ${examples.join("; ")}.` : "";
  const basis = useCands ? "the candidates" : "the digits and X's placed so far";
  return {
    technique: useCands ? "Clue Groups" : "Clue X's",
    level: useCands ? 4 : ways <= 4 ? 2 : 3,
    // Ways still open, plus how many the clue allows at all (each must be ruled out).
    weight: (useCands ? 9 : 0) + Math.min(ways, 12) + 0.5 * Math.log2(staticWays(line)),
    placements,
    eliminations: elims,
    region: line.cells,
    nudge: useCands ? `Look at ${line.name} (clue ${clue}) together with its candidates.` : `Look at ${line.name} (clue ${clue}): where can its X's go?`,
    explanation: `${Name} has the clue ${clue}. ${ways === 1 ? "Only one way" : `${ways} ways`} to place its two X's and split the digits into groups adding up to ${sums} ${ways === 1 ? "fits" : "fit"} ${basis}.${list} In ${ways === 1 ? "it" : "all of them"}, ${what}.`,
  };
}

const FINDERS: Finder[] = [
  singles(false),
  hiddenSingles(false),
  (p, s) => lineStep(p, s, false, false),
  singles(true),
  hiddenSingles(true),
  (p, s) => lineStep(p, s, true, false),
  (p, s) => lineStep(p, s, true, true),
];

/** The easiest step up to `maxLevel` (4 without trial), "contradiction", or null when stuck. */
function easiest(p: SumsPuzzle, s: SumsState): LiteStep | "contradiction" | null {
  for (const f of FINDERS) {
    const r = f(p, s);
    if (r) return r;
  }
  return null;
}

const solved = (s: SumsState) => s.placed.every(Boolean);

/** Apply steps up to level 4 until solved, stuck or contradicted. */
function propagate(p: SumsPuzzle, s: SumsState): "solved" | "stuck" | "contradiction" {
  for (let k = 0; k < 400; k++) {
    if (solved(s)) return "solved";
    const st = easiest(p, s);
    if (st === "contradiction") return "contradiction";
    if (!st) return "stuck";
    applyStep(p, s, st);
  }
  return "stuck";
}

const trialStep: Finder = (p, s) => {
  // Cells with the fewest possibilities first: those are the easiest to try.
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
          weight: 25,
          placements: [],
          eliminations: [{ cell: i, value: v }],
          region: [i],
          nudge: `Try a possibility in ${name} and follow where it leads.`,
          explanation: `Suppose ${name} were ${v ? v : "an X"}. Following the easier steps from there runs into a contradiction (some line can no longer add up), so ${name} ${v ? `isn't ${v}` : "isn't an X"}.`,
        };
      }
    }
  return null;
};

/** The next step (easiest first), or null when even trial finds nothing. */
export function nextStep(p: SumsPuzzle, s: SumsState): LiteStep | null {
  const r = easiest(p, s);
  if (r === "contradiction") return null;
  if (r) return r;
  const t = trialStep(p, s);
  return t === "contradiction" ? null : t;
}

export interface SumsSolve {
  steps: LiteStep[];
  solved: boolean;
}

/** Solve from the start, step by step (`trial` false: stop where trial would be needed). */
export function logicSolveSums(p: SumsPuzzle, from: SumsState = startState(p), trial = true): SumsSolve {
  const s = cloneState(from);
  const steps: LiteStep[] = [];
  for (let k = 0; k < 600 && !solved(s); k++) {
    const e = easiest(p, s);
    const st = e === "contradiction" ? null : e ?? (trial ? nextStep(p, s) : null);
    if (!st) break;
    steps.push(st);
    applyStep(p, s, st);
  }
  return { steps, solved: solved(s) };
}


export const SUMS_LEVELS = ["Easy", "Medium", "Hard", "Expert"] as const;
export type SumsLevel = (typeof SUMS_LEVELS)[number];

export interface SumsRating {
  /** Difficulty: total effort plus 4 per step of the longest stretch of X reasoning. */
  score: number;
  /** Sum of the step weights. */
  effort: number;
  /** Longest run of line steps before a digit is placed (working out where X's go). */
  xStretch: number;
  maxLevel: number;
  /** Steps that needed candidates written down (level 3 and up). */
  candidateSteps: number;
}

export function rateSums(steps: LiteStep[]): SumsRating {
  const effort = steps.reduce((a, s) => a + s.weight, 0);
  let run = 0;
  let xStretch = 0;
  for (const s of steps) {
    if (s.placements.some((x) => x.value > 0)) run = 0;
    else if (s.level > 1) xStretch = Math.max(xStretch, ++run);
  }
  return {
    score: effort + 4 * xStretch,
    effort,
    xStretch,
    maxLevel: steps.reduce((a, s) => Math.max(a, s.level), 0),
    candidateSteps: steps.filter((s) => s.level >= 3).length,
  };
}

/** Difficulty cut-offs per size: Easy up to [0], Medium up to [1], Hard up to [2], Expert above. */
export const SUMS_CUTS: Record<number, [number, number, number]> = { 6: [17, 25, 42], 7: [29, 40, 56], 8: [51, 74, 121] };

export function levelOf(n: number, r: SumsRating): SumsLevel {
  const cuts = SUMS_CUTS[n] ?? SUMS_CUTS[7];
  if (r.maxLevel >= 3 || r.score > cuts[2]) return "Expert";
  if (r.score > cuts[1]) return "Hard";
  if (r.score > cuts[0]) return "Medium";
  return "Easy";
}

/** Rate a puzzle (null when the steps can't solve it without trial). */
export function rateSumsPuzzle(p: SumsPuzzle): (SumsRating & { level: SumsLevel }) | null {
  const r = logicSolveSums(p, startState(p), false);
  if (!r.solved) return null;
  const rt = rateSums(r.steps);
  return { ...rt, level: levelOf(p.n, rt) };
}

/**
 * A puzzle of a size and level, made on the spot: random grids, kept when the steps solve
 * them from the clues alone (so exactly one solution and no given cells) and they rate at
 * the asked level. Yields between grids (for the page); after `budgetMs` it takes the grid
 * that came closest.
 */
export function* makeSums(n: number, level: SumsLevel, rnd: () => number, budgetMs = 3000): Generator<number, SumsPuzzle> {
  const t0 = performance.now();
  const want = SUMS_LEVELS.indexOf(level);
  let best: { p: SumsPuzzle; miss: number } | null = null;
  for (let tries = 1; ; tries++) {
    const solution = randomGrid(n, rnd);
    const p: SumsPuzzle = { n, solution, givens: new Array(n * n).fill(false), ...cluesOf(n, solution) };
    const r = rateSumsPuzzle(p);
    if (r) {
      const miss = Math.abs(SUMS_LEVELS.indexOf(r.level) - want);
      if (!miss) return p;
      if (!best || miss < best.miss) best = { p, miss };
    }
    if (best && performance.now() - t0 > budgetMs) return best.p;
    yield tries;
  }
}
