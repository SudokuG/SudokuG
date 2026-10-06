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
// Then the hard steps are spread out (see `spreadOut`): a random minimal puzzle tends to
// be singles, one lock that needs the hard technique, and singles again. Moving clues
// around gives puzzles that get stuck several times along the way.
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
  /** Spread the hard steps over the solve (default on). */
  spread?: boolean;
  /** Clue moves to try when spreading (default 1000). */
  spreadTries?: number;
}

export interface Generated {
  puzzle: number[];
  solution: number[];
  rating: Rating;
  /** Puzzles tried in total. */
  attempts: number;
}

export interface GenerateProgress {
  attempts: number;
  /** A puzzle was found; its hard steps are being spread out. */
  spreading?: boolean;
}

/** Steps from this level up (X-Wing and harder) count as hard steps. */
export const HARD_LEVEL = 5;
/** Hard steps with fewer placements than this between them belong to the same lock. */
const LOCK_GAP = 4;
/** How many separate locks to aim for, by the hardest group of the profile. */
export const SPREAD_TARGET: Partial<Record<Group, number>> = { Hard: 2, Expert: 3, Extreme: 3 };

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

export const spreadScore = (sp: Spread) => sp.locks * 10 + Math.min(sp.hardSteps, 10);

export function* generateRated(spec: GenerateSpec, rnd: () => number = Math.random): Generator<GenerateProgress, Generated> {
  const allowedSet = new Set([...spec.allowed, ...ALWAYS_ON]);
  const allowed = TECHNIQUES.filter((t) => allowedSet.has(t.name));
  // Allowed techniques first, the rest after: the first step outside the profile shows where a clue helps.
  const allowedFirst = [...allowed, ...TECHNIQUES.filter((t) => !allowedSet.has(t.name))];
  const must = new Set(hardestGroup(allowedSet).names);
  const symmetric = spec.symmetric ?? true;
  const maxAdded = spec.maxAddedClues ?? 6;
  let attempts = 0;

  const group = hardestGroup(allowedSet).group;
  const target = spec.spread === false ? 0 : SPREAD_TARGET[group] ?? 0;

  for (;;) {
    const { puzzle, solution } = generatePuzzle(rnd, symmetric);
    for (let added = 0; ; added++) {
      attempts++;
      const log = logicalSolve(new Grid(puzzle), allowed);
      yield { attempts };
      if (log.solved) {
        if (log.steps.some((s) => must.has(s.technique))) {
          const final = target ? yield* spreadOut(puzzle, solution, allowed, must, target, symmetric, spec.spreadTries ?? 1000, rnd, attempts) : puzzle;
          return { puzzle: final, solution, rating: ratePuzzle(new Grid(final)), attempts };
        }
        break; // too easy for this profile: start over
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
  }
}

/**
 * Move clues around to spread the hard steps over the solve: take out a clue (pair) and
 * put one in elsewhere; keep the change if the puzzle stays unique, solvable with the
 * profile, still needs a technique of its hardest group, and gets stuck at least as often.
 * Stops when it reaches `target` locks or after `tries` moves.
 */
function* spreadOut(
  start: number[],
  solution: number[],
  allowed: Technique[],
  must: Set<string>,
  target: number,
  symmetric: boolean,
  tries: number,
  rnd: () => number,
  attempts: number,
): Generator<GenerateProgress, number[]> {
  const judge = (p: number[]): Spread | null => {
    const log = logicalSolve(new Grid(p), allowed);
    return log.solved && log.steps.some((s) => must.has(s.technique)) ? spreadOf(log.steps) : null;
  };
  let cur = start.slice();
  let sp = judge(cur)!;
  // With symmetry, cells 0-40 stand for themselves and their mirror image.
  const half = symmetric ? 41 : 81;
  const pick = (want: boolean) => {
    const cells: number[] = [];
    for (let i = 0; i < half; i++) if (!!cur[i] === want) cells.push(i);
    return cells[Math.floor(rnd() * cells.length)];
  };
  let since = performance.now();
  for (let t = 0; t < tries && sp.locks < target; t++) {
    if (performance.now() - since > 25) {
      yield { attempts, spreading: true };
      since = performance.now();
    }
    // Mostly move a clue; sometimes just take one out (fewer clues: more places to get stuck).
    const out = pick(true);
    const into = rnd() < 0.3 ? undefined : pick(false);
    if (out === undefined) break;
    const next = cur.slice();
    next[out] = 0;
    if (symmetric) next[80 - out] = 0;
    if (into !== undefined) {
      next[into] = solution[into];
      if (symmetric) next[80 - into] = solution[80 - into];
    }
    if (countSolutions(next, 2).count !== 1) continue;
    const s = judge(next);
    if (!s) continue;
    if (spreadScore(s) >= spreadScore(sp)) {
      cur = next;
      sp = s;
    }
  }
  return cur;
}

/** Run the search to the end (for tests and scripts). */
export function generateRatedSync(spec: GenerateSpec, rnd: () => number = Math.random): Generated {
  const it = generateRated(spec, rnd);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
