// Generating puzzles from a technique profile.
//
// A profile is the set of techniques the player is happy to use. A generated puzzle
//   1. can be solved with only those techniques, and
//   2. needs at least one technique from the hardest group in the profile
//      (otherwise an "Expert" profile could hand out an easy puzzle).
// Grind is handled by the profile itself: triples, quads and long multi-digit chains
// are simply left out of the templates, and players can switch them on if they like them.
//
// Strategy: make a random minimal puzzle and solve it with the allowed techniques.
//   - Solved and it used a hardest-group technique: done.
//   - Solved without one: too easy, start over.
//   - Stuck: give a clue back where the first not-allowed step would act, and try again.
// Then, for Hard and up, clues are moved around until the puzzle needs enough hard moves
// (see REQUIREMENTS): a random minimal puzzle tends to be singles, one lock that needs the
// hard technique, and singles again. If one candidate can't get there, the next one is
// tried, and in the end the best one is taken.
// The search is a generator function that yields after every attempt, so the page
// can show progress and stay responsive.

import { generatePuzzle } from "./generator";
import { countSolutions } from "./solver";
import { Grid } from "./grid";
import { logicalSolve } from "./hints";
import { DIFFICULTIES, Rating, difficultyLabel, ratePuzzle } from "./rating";
import { TECHNIQUES } from "./techniques";
import type { Step, Technique } from "./types";

export type Group = (typeof DIFFICULTIES)[number];

/** The difficulty group a technique belongs to. */
export const groupOf = (name: string): Group => {
  const t = TECHNIQUES.find((t) => t.name === name);
  return (t ? difficultyLabel(t.level, true) : "Extreme") as Group;
};

/** Singles are always allowed: without them no puzzle can be solved. */
export const ALWAYS_ON = TECHNIQUES.filter((t) => t.level <= 1).map((t) => t.name);

/** Left out of the templates because finding them is a grind. */
export const OFF_BY_DEFAULT = new Set(["Naked Triple", "Hidden Triple", "Naked Quad", "Hidden Quad", "XY-Chain", "Alternating Inference Chain"]);

/** Template profiles: every technique up to that group, except the grindy ones. */
export const TEMPLATES: Record<Group, string[]> = Object.fromEntries(
  DIFFICULTIES.map((g, i) => [
    g,
    TECHNIQUES.filter((t) => DIFFICULTIES.indexOf(groupOf(t.name)) <= i && !OFF_BY_DEFAULT.has(t.name)).map((t) => t.name),
  ]),
) as Record<Group, string[]>;

/** The template a profile matches exactly, or null for a custom profile. */
export function templateOf(allowed: Iterable<string>): Group | null {
  const set = new Set(allowed);
  for (const g of DIFFICULTIES) {
    const t = TEMPLATES[g];
    if (t.length === set.size && t.every((n) => set.has(n))) return g;
  }
  return null;
}

/** Techniques of the hardest group that has anything switched on. */
export function hardestGroup(allowed: Iterable<string>): { group: Group; names: string[] } {
  const set = new Set([...allowed, ...ALWAYS_ON]);
  for (let i = DIFFICULTIES.length - 1; i >= 0; i--) {
    const names = [...set].filter((n) => groupOf(n) === DIFFICULTIES[i]);
    if (names.length) return { group: DIFFICULTIES[i], names };
  }
  return { group: "Easy", names: ALWAYS_ON };
}

export interface GenerateSpec {
  /** Names of the techniques the puzzle may need (singles are always included). */
  allowed: string[];
  /** Keep clues in 180° rotational symmetry. */
  symmetric?: boolean;
  /** How many clues may be added back to a single puzzle. */
  maxAddedClues?: number;
  /** Aim for the move counts of REQUIREMENTS (default on). */
  requirements?: boolean;
  /** Clue moves to try on one candidate puzzle (default 1500). */
  triesPerCandidate?: number;
  /** Candidate puzzles to try at most before taking the best one (default 50). */
  maxCandidates?: number;
  /** Stop looking for a better puzzle after this many ms and take the best one (default: no limit). */
  timeBudgetMs?: number;
  /** Give up after this many puzzles tried without finding any that fits (default: never). */
  maxAttempts?: number;
}

export interface Generated {
  puzzle: number[];
  solution: number[];
  rating: Rating;
  /** Puzzles tried in total. */
  attempts: number;
  /** Moves (and separate locks) still missing from the requirements (0: all met). */
  missing: number;
  /** Hard, expert and extreme moves on the easiest-first path. */
  moves: MoveCounts;
}

export interface GenerateProgress {
  attempts: number;
  /** Candidate puzzles found so far; while > 0 the search is improving them. */
  candidates: number;
  /** Moves the best candidate still misses (Infinity before the first candidate). */
  missing: number;
}

/** Steps from this level up (X-Wing and harder) count as hard steps. */
export const HARD_LEVEL = 5;
/** Hard steps with fewer placements than this between them belong to the same lock. */
const LOCK_GAP = 4;

export interface Spread {
  /** Times the solve gets stuck and needs a hard step (separated by at least LOCK_GAP placements). */
  locks: number;
  /** Hard steps in total. */
  hardSteps: number;
}

/** How the hard steps of a solve (easiest move first) are spread out. */
export function spreadOf(steps: Step[]): Spread {
  let locks = 0;
  let hardSteps = 0;
  let filled = 0;
  let last = -Infinity;
  for (const s of steps) {
    if (s.level >= HARD_LEVEL) {
      hardSteps++;
      if (filled - last >= LOCK_GAP) locks++;
      last = filled;
    }
    filled += s.placements.length;
  }
  return { locks, hardSteps };
}

// ---------------------------------------------------------------------------
// Requirements: how many moves of each group a good puzzle of a difficulty needs, on the
// easiest-first path (so these are moves you can't avoid). They cascade: a harder move also
// counts for an easier group, so an Extreme puzzle with four expert moves needs fewer hard
// ones. Internally that means: at least 1 move of Extreme level, at least 1+2 = 3 of Expert
// level or harder, and at least 1+2+5 = 8 of Hard level or harder.

export type MoveCounts = Record<"Hard" | "Expert" | "Extreme", number>;
const TIERS = ["Hard", "Expert", "Extreme"] as const;

export interface Requirement extends Partial<MoveCounts> {
  /** Separate places in the solve where you get stuck and need a hard move (see spreadOf). */
  locks?: number;
}

/** Moves needed per group (before cascading) and separate locks, by the hardest group of the profile. */
export const REQUIREMENTS: Partial<Record<Group, Requirement>> = {
  Hard: { Hard: 3, locks: 2 },
  Expert: { Expert: 2, Hard: 3, locks: 2 },
  Extreme: { Extreme: 1, Expert: 2, Hard: 5, locks: 3 },
};

/** Moves of each group on a solve path. */
export function moveCounts(steps: Step[]): MoveCounts {
  const c: MoveCounts = { Hard: 0, Expert: 0, Extreme: 0 };
  for (const s of steps) {
    const g = difficultyLabel(s.level, true) as Group;
    if (g === "Hard" || g === "Expert" || g === "Extreme") c[g]++;
  }
  return c;
}

/** Moves still missing to meet `req`, counting harder moves toward easier needs. */
export function missingMoves(c: MoveCounts, req: Requirement): number {
  let missing = 0;
  let need = 0;
  let have = 0;
  for (let k = TIERS.length - 1; k >= 0; k--) {
    need += req[TIERS[k]] ?? 0;
    have += c[TIERS[k]];
    missing = Math.max(missing, need - have);
  }
  return missing;
}

interface Judged {
  puzzle: number[];
  missing: number;
  moves: MoveCounts;
  spread: Spread;
}
/** Higher is better: fewer missing moves first, then more separate locks, then more hard moves. */
const score = (j: Judged) => -j.missing * 1000 + j.spread.locks * 10 + Math.min(j.spread.hardSteps, 12);

export function* generateRated(spec: GenerateSpec, rnd: () => number = Math.random): Generator<GenerateProgress, Generated | null> {
  const allowedSet = new Set([...spec.allowed, ...ALWAYS_ON]);
  const allowed = TECHNIQUES.filter((t) => allowedSet.has(t.name));
  // Allowed techniques first, the rest after: the first step outside the profile shows where a clue helps.
  const allowedFirst = [...allowed, ...TECHNIQUES.filter((t) => !allowedSet.has(t.name))];
  const { group, names } = hardestGroup(allowedSet);
  const must = new Set(names);
  const symmetric = spec.symmetric ?? true;
  const maxAdded = spec.maxAddedClues ?? 6;
  const req: Requirement = spec.requirements === false ? {} : REQUIREMENTS[group] ?? {};
  const improve = Object.keys(req).length > 0;
  const maxCandidates = improve ? spec.maxCandidates ?? 50 : 1;
  const t0 = performance.now();
  let attempts = 0;
  let candidates = 0;
  let best: (Judged & { solution: number[] }) | null = null;

  const judge = (p: number[]): Judged | null => {
    const log = logicalSolve(new Grid(p), allowed);
    if (!log.solved || !log.steps.some((s) => must.has(s.technique))) return null;
    const moves = moveCounts(log.steps);
    const spread = spreadOf(log.steps);
    return { puzzle: p, moves, spread, missing: missingMoves(moves, req) + Math.max(0, (req.locks ?? 0) - spread.locks) };
  };
  const finish = (b: Judged & { solution: number[] }): Generated => ({
    puzzle: b.puzzle,
    solution: b.solution,
    rating: ratePuzzle(new Grid(b.puzzle)),
    attempts,
    missing: b.missing,
    moves: b.moves,
  });
  const outOfTime = () => spec.timeBudgetMs !== undefined && performance.now() - t0 > spec.timeBudgetMs;

  for (;;) {
    if (spec.maxAttempts !== undefined && attempts >= spec.maxAttempts) return best ? finish(best) : null;
    // 1. A puzzle that fits the profile.
    const { puzzle, solution } = generatePuzzle(rnd, symmetric);
    let found: Judged | null = null;
    for (let added = 0; ; added++) {
      attempts++;
      const log = logicalSolve(new Grid(puzzle), allowed);
      yield { attempts, candidates, missing: best?.missing ?? Infinity };
      if (log.solved) {
        if (log.steps.some((s) => must.has(s.technique))) found = judge(puzzle);
        break; // fits, or too easy for this profile: start over
      }
      if (added >= maxAdded) break;
      // Give a clue back where the first step outside the profile acts.
      const full = logicalSolve(new Grid(puzzle), allowedFirst);
      const bad = full.steps.find((s) => !allowedSet.has(s.technique));
      const cells = bad ? [...bad.placements.map((p) => p.cell), ...bad.eliminations.map((e) => e.cell), ...bad.cells] : [];
      let c = cells.find((i) => !puzzle[i]);
      if (c === undefined) {
        const empty = full.final.values.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0 && !puzzle[i]);
        if (!empty.length) break;
        c = empty[Math.floor(rnd() * empty.length)];
      }
      puzzle[c] = solution[c];
      if (symmetric && !puzzle[80 - c]) puzzle[80 - c] = solution[80 - c];
    }
    if (!found) {
      if (best && outOfTime()) return finish(best);
      continue;
    }
    candidates++;
    // 2. Move clues around until it has the moves the difficulty asks for.
    const j = improve ? yield* moveClues(found, solution, judge, symmetric, spec.triesPerCandidate ?? 1500, rnd, () => ({ attempts, candidates, missing: Math.min(best?.missing ?? Infinity, found!.missing) }), outOfTime) : found;
    if (!best || score(j) > score(best)) best = { ...j, solution };
    if (best.missing === 0 || candidates >= maxCandidates || outOfTime()) return finish(best);
  }
}

/**
 * Move clues around to get the moves a difficulty asks for: take a clue (pair) out and put
 * one in elsewhere, or just take one out; keep the change when the puzzle keeps one
 * solution, still fits the profile and scores at least as well. Stops when nothing is
 * missing, after `tries` moves, or when time is up.
 */
function* moveClues(
  start: Judged,
  solution: number[],
  judge: (p: number[]) => Judged | null,
  symmetric: boolean,
  tries: number,
  rnd: () => number,
  progress: () => GenerateProgress,
  outOfTime: () => boolean,
): Generator<GenerateProgress, Judged> {
  let cur = start;
  // With symmetry, cells 0-40 stand for themselves and their mirror image.
  const half = symmetric ? 41 : 81;
  const pick = (want: boolean) => {
    const cells: number[] = [];
    for (let i = 0; i < half; i++) if (!!cur.puzzle[i] === want) cells.push(i);
    return cells[Math.floor(rnd() * cells.length)];
  };
  let since = performance.now();
  for (let t = 0; t < tries && cur.missing > 0; t++) {
    if (performance.now() - since > 25) {
      yield progress();
      if (outOfTime()) break;
      since = performance.now();
    }
    const out = pick(true);
    const into = rnd() < 0.3 ? undefined : pick(false);
    if (out === undefined) break;
    const next = cur.puzzle.slice();
    next[out] = 0;
    if (symmetric) next[80 - out] = 0;
    if (into !== undefined) {
      next[into] = solution[into];
      if (symmetric) next[80 - into] = solution[80 - into];
    }
    if (countSolutions(next, 2).count !== 1) continue;
    const j = judge(next);
    if (j && score(j) >= score(cur)) cur = j;
  }
  return cur;
}

/** Run the search to the end (for tests and scripts). */
export function generateRatedSync(spec: GenerateSpec, rnd: () => number = Math.random): Generated {
  const it = generateRated(spec, rnd);
  for (;;) {
    const r = it.next();
    if (r.done) {
      if (!r.value) throw new Error("No puzzle found within maxAttempts.");
      return r.value;
    }
  }
}
