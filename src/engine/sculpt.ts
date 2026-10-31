// Sculpting puzzles, the way a setter works: start from a full grid and keep taking clues
// away for as long as the puzzle stays solvable with the allowed techniques. What is left
// has about as few clues as that set of techniques allows, so the solve leans on patterns
// instead of a long run of singles. Then clues are shuffled around (take one out, put one
// in elsewhere) to collect the moves a difficulty asks for (see RECIPES).
//
// Nothing here needs the brute-force solver: a puzzle that the (sound) techniques solve
// all the way has exactly one solution.
//
// The hardest moves are capped, not just counted: an Expert puzzle has one to three expert
// moves, an Extreme puzzle one or two extreme moves and at most three expert ones. The rest
// of the work is meant to be X-Wings, Skyscrapers, 2-String Kites, Turbot Fish and hidden
// pairs (the "hard family").

import { randomSolution } from "./generator";
import { Grid, UNITS } from "./grid";
import { logicalSolve } from "./hints";
import { countSolutions } from "./solver";
import { difficultyLabel } from "./rating";
import type { Step, Technique } from "./types";

/** X-Wing and the one-digit patterns of the same level: the backbone of Hard and up. */
export const HARD_FAMILY = new Set(["X-Wing", "Skyscraper", "2-String Kite", "Turbot Fish"]);

/** Steps from this level up (pairs, X-Wings and harder) mark a lock: singles ran dry, a pattern is needed. */
export const LOCK_LEVEL = 3;
/** Pattern steps with fewer placements than this between them belong to the same lock. */
export const LOCK_GAP = 4;

export interface Recipe {
  /** At least this many pattern moves: hard-family moves and hidden pairs together. */
  patterns: number;
  /** At least this many hard-family moves (X-Wing, Skyscraper, 2-String Kite, Turbot Fish). */
  hard: number;
  /** At least this many hidden pairs. */
  hiddenPairs: number;
  /** Moves of the profile's hardest group (Expert or Extreme): at least [0], at most [1]. */
  top: [number, number];
  /** At most this many expert moves (for Extreme). */
  expertMax?: number;
  /** Separate places where singles run dry and a pair, X-Wing or harder is needed. */
  locks: number;
  /** At most this many clues. */
  clues: number;
}

export type RecipeGroup = "Hard" | "Expert" | "Extreme";

/** What a good puzzle of each difficulty needs, on the easiest-move-first solve path. */
export const RECIPES: Record<RecipeGroup, Recipe> = {
  Hard: { patterns: 5, hard: 3, hiddenPairs: 1, top: [0, Infinity], locks: 2, clues: 26 },
  Expert: { patterns: 5, hard: 3, hiddenPairs: 1, top: [1, 3], locks: 2, clues: 26 },
  Extreme: { patterns: 5, hard: 3, hiddenPairs: 1, top: [1, 2], expertMax: 3, locks: 2, clues: 26 },
};

/** The shape of a solve: what it needs, on the easiest-move-first path. */
export interface Shape {
  solved: boolean;
  clues: number;
  /** Hard-family moves. */
  hard: number;
  hiddenPairs: number;
  nakedPairs: number;
  /** Moves of the profile's hardest group. */
  top: number;
  expert: number;
  extreme: number;
  locks: number;
  /** Placements made before the first move harder than a single (low = patterns early). */
  opening: number;
  steps: Step[];
  /** Values where the techniques stopped (all filled when solved). */
  final: number[];
}

/**
 * Place every single (full house, hidden single, naked single) until none is left. Singles
 * always come first on the easiest-first path, and placing them in any order ends in the
 * same position, so this reaches exactly the position where the next harder move is
 * needed, much faster than finding them one by one with explanations.
 * Returns the number of digits placed.
 */
export function placeSingles(g: Grid): number {
  let placed = 0;
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < 81; i++) {
      const m = g.cands[i];
      if (!g.values[i] && m && (m & (m - 1)) === 0) {
        g.place(i, 31 - Math.clz32(m) + 1);
        placed++;
        changed = true;
      }
    }
    for (const u of UNITS) {
      let once = 0;
      let twice = 0;
      let done = 0;
      for (const c of u.cells) {
        if (g.values[c]) done |= 1 << (g.values[c] - 1);
        else {
          twice |= once & g.cands[c];
          once |= g.cands[c];
        }
      }
      let hidden = once & ~twice & ~done;
      while (hidden) {
        const b = hidden & -hidden;
        hidden &= ~b;
        for (const c of u.cells)
          if (!g.values[c] && g.cands[c] & b) {
            g.place(c, 31 - Math.clz32(b) + 1);
            placed++;
            changed = true;
            break;
          }
      }
    }
  }
  return placed;
}

/** Shape of the easiest-first solve with these techniques (singles handled by placeSingles). */
export function shapeOf(puzzle: number[], allowed: Technique[], topGroup: string): Shape {
  const harder = allowed.filter((t) => t.level > 1);
  const g = new Grid(puzzle);
  const s: Shape = { solved: false, clues: puzzle.filter(Boolean).length, hard: 0, hiddenPairs: 0, nakedPairs: 0, top: 0, expert: 0, extreme: 0, locks: 0, opening: -1, steps: [], final: g.values };
  let filled = 0;
  let last = -Infinity;
  for (;;) {
    filled += placeSingles(g);
    if (g.isSolved()) {
      s.solved = true;
      break;
    }
    let st: Step | null = null;
    for (const t of harder) if ((st = t.find(g))) break;
    if (!st) break;
    s.steps.push(st);
    const grp = difficultyLabel(st.level, true);
    if (HARD_FAMILY.has(st.technique)) s.hard++;
    else if (st.technique === "Hidden Pair") s.hiddenPairs++;
    else if (st.technique === "Naked Pair") s.nakedPairs++;
    if (grp === "Expert") s.expert++;
    if (grp === "Extreme") s.extreme++;
    if (grp === topGroup) s.top++;
    if (st.level >= LOCK_LEVEL) {
      if (filled - last >= LOCK_GAP) s.locks++;
      last = filled;
    }
    if (s.opening < 0) s.opening = filled;
    for (const e of st.eliminations) g.eliminate(e.cell, e.digit);
    for (const p of st.placements) g.place(p.cell, p.digit);
    filled += st.placements.length;
  }
  if (s.opening < 0) s.opening = filled;
  s.final = g.values;
  return s;
}

/** The same with the full step-by-step solver (slow; tests check that both agree). */
export function shapeOfSlow(puzzle: number[], allowed: Technique[], topGroup: string): Shape {
  const log = logicalSolve(new Grid(puzzle), allowed);
  const s: Shape = { solved: log.solved, clues: puzzle.filter(Boolean).length, hard: 0, hiddenPairs: 0, nakedPairs: 0, top: 0, expert: 0, extreme: 0, locks: 0, opening: -1, steps: [], final: log.final.values };
  let filled = 0;
  let last = -Infinity;
  for (const st of log.steps) {
    if (st.level > 1) {
      s.steps.push(st);
      const grp = difficultyLabel(st.level, true);
      if (HARD_FAMILY.has(st.technique)) s.hard++;
      else if (st.technique === "Hidden Pair") s.hiddenPairs++;
      else if (st.technique === "Naked Pair") s.nakedPairs++;
      if (grp === "Expert") s.expert++;
      if (grp === "Extreme") s.extreme++;
      if (grp === topGroup) s.top++;
      if (st.level >= LOCK_LEVEL) {
        if (filled - last >= LOCK_GAP) s.locks++;
        last = filled;
      }
      if (s.opening < 0) s.opening = filled;
    }
    filled += st.placements.length;
  }
  if (s.opening < 0) s.opening = filled;
  return s;
}

/** The recipe's hard limits: solvable, and not too many of the hardest moves. */
export const withinCaps = (s: Shape, r: Recipe) => s.solved && s.top <= r.top[1] && s.expert <= (r.expertMax ?? Infinity);

/** Moves (and locks, and clues) still missing to meet the recipe. */
export function missingOf(s: Shape, r: Recipe): number {
  return (
    Math.max(0, r.patterns - s.hard - s.hiddenPairs) +
    Math.max(0, r.hard - s.hard) +
    Math.max(0, r.hiddenPairs - s.hiddenPairs) +
    Math.max(0, r.top[0] - s.top) +
    Math.max(0, r.locks - s.locks) +
    Math.max(0, s.clues - r.clues)
  );
}

/** Higher is better. Meeting the recipe counts most; beyond that more patterns and fewer clues. */
export function scoreOf(s: Shape, r: Recipe): number {
  return (
    -missingOf(s, r) * 100 +
    Math.min(s.hard, r.hard + 4) * 6 +
    Math.min(s.hiddenPairs, r.hiddenPairs + 3) * 5 +
    Math.min(s.nakedPairs, 4) +
    Math.min(s.locks, 6) * 3 -
    s.clues * 2 -
    Math.min(s.opening, 30) * 0.25
  );
}

export interface SculptSpec {
  allowed: Technique[];
  /** The profile's hardest group (moves of it are counted as `top`). */
  topGroup: string;
  recipe: Recipe;
  symmetric: boolean;
  /** Clue moves per starting grid before trying a fresh grid. */
  triesPerGrid: number;
  /** Give up on a grid after this many moves without improvement. */
  patience: number;
  /** Skip the search when the first puzzle misses more than this. */
  prefilter?: number;
  /** Take clues away with the easier techniques first, then the full set. */
  staged?: boolean;
}

export interface Sculpted {
  puzzle: number[];
  solution: number[];
  shape: Shape;
  missing: number;
  score: number;
}

const shuffle = <T>(a: T[], rnd: () => number): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Sculpt one puzzle from one random full grid. Yields every ~25 ms (for the page) with
 * the best result so far. Stops when the recipe is met, after `triesPerGrid` moves, after
 * `patience` moves without improvement, or when `stop()` says so.
 */
export function* sculptGrid(spec: SculptSpec, rnd: () => number, stop: () => boolean): Generator<Sculpted | null, Sculpted> {
  const { allowed, topGroup, recipe: r, symmetric } = spec;
  const solution = randomSolution(rnd);
  const half = symmetric ? 41 : 81;
  const set = (p: number[], c: number, on: boolean) => {
    p[c] = on ? solution[c] : 0;
    if (symmetric) p[80 - c] = on ? solution[80 - c] : 0;
  };
  const judge = (p: number[]): Shape | null => {
    const s = shapeOf(p, allowed, topGroup);
    return withinCaps(s, r) ? s : null;
  };
  let since = performance.now();

  // 1. Take clues away in random order while the puzzle stays solvable (and within the caps).
  //    With stages: first with the Hard techniques only, then with the full set.
  let puzzle = solution.slice();
  const stages = spec.staged
    ? [5.5, 7, Infinity].map((max) => allowed.filter((t) => t.level <= max)).filter((a, i, all) => i === all.length - 1 || a.length < all[i + 1].length)
    : [allowed];
  for (const stage of stages) {
    for (const c of shuffle([...Array(half).keys()], rnd)) {
      if (!puzzle[c]) continue;
      const next = puzzle.slice();
      set(next, c, false);
      if (withinCaps(shapeOf(next, stage, topGroup), r)) puzzle = next;
      if (performance.now() - since > 25) {
        yield null;
        if (stop()) break;
        since = performance.now();
      }
    }
  }
  const shape = judge(puzzle) ?? judge((puzzle = solution.slice()))!;
  let cur: Sculpted = { puzzle, solution, shape, missing: missingOf(shape, r), score: scoreOf(shape, r) };

  // 2. Move clues around. Two kinds of move, kept when the result scores at least as well
  //    (or, now and then, a little worse, so the search doesn't get stuck on a plateau):
  //    - repair: take a clue (pair) out, then try every empty place for one to put back and
  //      take the best one that gives a puzzle within the caps again;
  //    - jolt: put a few clues back at random and take clues away again in a fresh order.
  const cells = (want: boolean, p: number[]) => {
    const out: number[] = [];
    for (let i = 0; i < half; i++) if (!!p[i] === want) out.push(i);
    return out;
  };
  const pick = (a: number[]) => a[Math.floor(rnd() * a.length)];
  let best = cur;
  if (spec.prefilter !== undefined && cur.missing > spec.prefilter) return best;
  let stale = 0;
  for (let t = 0; t < spec.triesPerGrid && best.missing > 0 && stale < spec.patience; t++) {
    if (performance.now() - since > 25) {
      yield best;
      if (stop()) break;
      since = performance.now();
    }
    let cand: Sculpted | null = null;
    const consider = (p: number[], s: Shape | null) => {
      if (!s) return;
      const sc = scoreOf(s, r);
      if (!cand || sc > cand.score || (sc === cand.score && rnd() < 0.5)) cand = { puzzle: p, solution, shape: s, missing: missingOf(s, r), score: sc };
    };
    if (rnd() < 0.7) {
      const base = cur.puzzle.slice();
      set(base, pick(cells(true, base)), false);
      // Taking it out alone may already work.
      if (countSolutions(base, 2).count === 1) consider(base, judge(base));
      for (const c of shuffle(cells(false, base), rnd)) {
        const next = base.slice();
        set(next, c, true);
        if (next.join("") === cur.puzzle.join("")) continue;
        if (countSolutions(next, 2).count !== 1) continue;
        consider(next, judge(next));
      }
    } else {
      let next = cur.puzzle.slice();
      const empty = shuffle(cells(false, next), rnd);
      const k = 2 + Math.floor(rnd() * 3);
      for (const c of empty.slice(0, k)) set(next, c, true);
      let s = judge(next);
      for (const c of shuffle(cells(true, next), rnd)) {
        const q = next.slice();
        set(q, c, false);
        const sq = judge(q);
        if (sq) {
          next = q;
          s = sq;
        }
      }
      consider(next, s);
    }
    stale++;
    const c = cand as Sculpted | null;
    if (!c) continue;
    // Accept better or equal; accept worse with a small chance that shrinks as it gets worse.
    if (c.score >= cur.score || rnd() < Math.exp((c.score - cur.score) / 8)) cur = c;
    if (cur.score > best.score) {
      best = cur;
      stale = 0;
    }
  }
  return best;
}

export interface SculptRun {
  allowed: Technique[];
  topGroup: string;
  recipe: Recipe;
  symmetric?: boolean;
  /** Skip a grid whose first puzzle misses more than this (searching it rarely pays off). */
  prefilter?: number;
  /** Stop after this many ms and return the best so far. */
  timeBudgetMs?: number;
  /** Stop after this many grids and return the best so far. */
  maxGrids?: number;
  triesPerGrid?: number;
  patience?: number;
  staged?: boolean;
}

/**
 * Sculpt grid after grid until one meets the recipe; yields often. When time runs out it
 * returns the best puzzle so far that uses the hardest group at least once (it keeps going
 * until it has one, or until `maxGrids`, and then returns the best it has).
 */
export function* sculpt(run: SculptRun, rnd: () => number): Generator<{ grids: number; best: Sculpted | null }, Sculpted & { grids: number }> {
  const t0 = performance.now();
  const outOfTime = () => run.timeBudgetMs !== undefined && performance.now() - t0 > run.timeBudgetMs;
  const usesTop = (x: Sculpted) => x.shape.top >= Math.max(1, run.recipe.top[0]);
  let best: Sculpted | null = null;
  let fallback: Sculpted | null = null;
  let grids = 0;
  for (;;) {
    grids++;
    const spec: SculptSpec = {
      allowed: run.allowed,
      topGroup: run.topGroup,
      recipe: run.recipe,
      symmetric: run.symmetric ?? true,
      triesPerGrid: run.triesPerGrid ?? 300,
      patience: run.patience ?? 60,
      prefilter: run.prefilter ?? 7,
      staged: run.staged ?? false,
    };
    const it = sculptGrid(spec, rnd, () => outOfTime() && !!best);
    let r = it.next();
    while (!r.done) {
      yield { grids, best };
      r = it.next();
    }
    const x = r.value;
    if (usesTop(x)) {
      if (!best || x.score > best.score) best = x;
    } else if (!fallback || x.score > fallback.score) fallback = x;
    if (best && (best.missing === 0 || outOfTime())) return { ...best, grids };
    if (run.maxGrids !== undefined && grids >= run.maxGrids) return { ...(best ?? fallback ?? x), grids };
  }
}
