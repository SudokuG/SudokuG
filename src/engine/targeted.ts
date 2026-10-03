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
// The search is a generator function that yields after every attempt, so the page
// can show progress and stay responsive.

import { generatePuzzle } from "./generator";
import { Grid } from "./grid";
import { logicalSolve } from "./hints";
import { DIFFICULTIES, Rating, difficultyLabel, ratePuzzle } from "./rating";
import { TECHNIQUES } from "./techniques";

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
}

export function* generateRated(spec: GenerateSpec, rnd: () => number = Math.random): Generator<GenerateProgress, Generated> {
  const allowedSet = new Set([...spec.allowed, ...ALWAYS_ON]);
  const allowed = TECHNIQUES.filter((t) => allowedSet.has(t.name));
  // Allowed techniques first, the rest after: the first step outside the profile shows where a clue helps.
  const allowedFirst = [...allowed, ...TECHNIQUES.filter((t) => !allowedSet.has(t.name))];
  const must = new Set(hardestGroup(allowedSet).names);
  const symmetric = spec.symmetric ?? true;
  const maxAdded = spec.maxAddedClues ?? 6;
  let attempts = 0;

  for (;;) {
    const { puzzle, solution } = generatePuzzle(rnd, symmetric);
    for (let added = 0; ; added++) {
      attempts++;
      const log = logicalSolve(new Grid(puzzle), allowed);
      yield { attempts };
      if (log.solved) {
        if (log.steps.some((s) => must.has(s.technique))) {
          return { puzzle, solution, rating: ratePuzzle(new Grid(puzzle)), attempts };
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

/** Run the search to the end (for tests and scripts). */
export function generateRatedSync(spec: GenerateSpec, rnd: () => number = Math.random): Generated {
  const it = generateRated(spec, rnd);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
