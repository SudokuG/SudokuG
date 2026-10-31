// Generating puzzles from a technique profile.
//
// A profile is the set of techniques the player is happy to use. A generated puzzle
//   1. can be solved with only those techniques, and
//   2. needs at least one technique from the hardest group in the profile
//      (otherwise an "Expert" profile could hand out an easy puzzle).
// Grind is handled by the profile itself: triples, quads and long multi-digit chains
// are simply left out of the templates, and players can switch them on if they like them.
// For Hard and up the puzzle is sculpted to a recipe (sculpt.ts, RECIPES).
// The search is a generator function that yields often, so the page can show progress
// and stay responsive.

import { generatePuzzle } from "./generator";
import { Grid } from "./grid";
import { logicalSolve } from "./hints";
import { DIFFICULTIES, Rating, difficultyLabel, ratePuzzle } from "./rating";
import { RECIPES, missingOf, sculpt, shapeOf, withinCaps } from "./sculpt";
import type { Recipe, RecipeGroup, Shape } from "./sculpt";
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
  /** Aim for the recipe of the profile's hardest group (default on; see RECIPES). */
  requirements?: boolean;
  /** Stop looking for a better puzzle after this many ms and take the best one (default: no limit). */
  timeBudgetMs?: number;
  /** Give up after this many grids (sculpted) or tries (Easy, Medium) (default: never). */
  maxAttempts?: number;
  /** Sculpting: skip a grid whose first puzzle misses more than this many moves. */
  prefilter?: number;
}

export interface Generated {
  puzzle: number[];
  solution: number[];
  rating: Rating;
  /** Puzzles tried in total. */
  attempts: number;
  /** Moves (and locks, and clues) still missing from the recipe (0: all met). */
  missing: number;
  /** What the solve needs, easiest move first. */
  shape: ShapeSummary;
}

export interface GenerateProgress {
  attempts: number;
  /** 1 once a puzzle is in hand that is being improved. */
  candidates: number;
  /** Moves the best puzzle so far still misses (Infinity before the first one). */
  missing: number;
}

// ---------------------------------------------------------------------------
// Hard, Expert and Extreme (and custom mixes whose hardest group is one of those) are
// sculpted (see sculpt.ts): few clues, lots of X-Wings, Skyscrapers, Kites, Turbot Fish and
// hidden pairs, and only one or two of the hardest moves. Easy and Medium use the simple
// search below: a random minimal puzzle, with clues given back where it needs more than
// the profile allows.

const isRecipeGroup = (g: string): g is RecipeGroup => g === "Hard" || g === "Expert" || g === "Extreme";

/** The recipe for a profile: that of its hardest group, which must be used at least once. */
export function recipeFor(group: Group): Recipe | null {
  if (!isRecipeGroup(group)) return null;
  const r = RECIPES[group];
  return { ...r, top: [Math.max(1, r.top[0]), r.top[1]] };
}

/** How a puzzle measures up to the recipe of a template (null: the template has none). */
export function judgeTemplate(puzzle: number[], g: Group): { shape: Shape; missing: number; fits: boolean } | null {
  const recipe = recipeFor(g);
  if (!recipe) return null;
  const shape = shapeOf(puzzle, TECHNIQUES.filter((t) => TEMPLATES[g].includes(t.name)), g);
  const missing = missingOf(shape, recipe);
  return { shape, missing, fits: withinCaps(shape, recipe) && missing === 0 };
}

/** Whether a puzzle can be solved with a template's techniques and meets its recipe (if any). */
export function meetsRecipe(puzzle: number[], g: Group): boolean {
  const j = judgeTemplate(puzzle, g);
  if (j) return j.fits;
  return logicalSolve(new Grid(puzzle), TECHNIQUES.filter((t) => TEMPLATES[g].includes(t.name))).solved;
}

export function* generateRated(spec: GenerateSpec, rnd: () => number = Math.random): Generator<GenerateProgress, Generated | null> {
  const allowedSet = new Set([...spec.allowed, ...ALWAYS_ON]);
  const allowed = TECHNIQUES.filter((t) => allowedSet.has(t.name));
  const { group, names } = hardestGroup(allowedSet);
  const must = new Set(names);
  const symmetric = spec.symmetric ?? true;
  const recipe = spec.requirements === false ? null : recipeFor(group);
  const t0 = performance.now();

  if (recipe) {
    const it = sculpt({ allowed, topGroup: group, recipe, symmetric, timeBudgetMs: spec.timeBudgetMs, maxGrids: spec.maxAttempts, prefilter: spec.prefilter }, rnd);
    let r = it.next();
    while (!r.done) {
      yield { attempts: r.value.grids, candidates: r.value.best ? 1 : 0, missing: r.value.best?.missing ?? Infinity };
      r = it.next();
    }
    const b = r.value;
    // A custom mix must still use its hardest group at least once.
    if (!b.shape.steps.some((s) => must.has(s.technique))) return null;
    return {
      puzzle: b.puzzle,
      solution: b.solution,
      rating: ratePuzzle(new Grid(b.puzzle)),
      attempts: b.grids,
      missing: b.missing,
      shape: summary(b.shape),
    };
  }

  // Easy and Medium.
  const allowedFirst = [...allowed, ...TECHNIQUES.filter((t) => !allowedSet.has(t.name))];
  const maxAdded = spec.maxAddedClues ?? 6;
  let attempts = 0;
  for (;;) {
    if (spec.maxAttempts !== undefined && attempts >= spec.maxAttempts) return null;
    const { puzzle, solution } = generatePuzzle(rnd, symmetric);
    for (let added = 0; ; added++) {
      attempts++;
      const log = logicalSolve(new Grid(puzzle), allowed);
      yield { attempts, candidates: 0, missing: Infinity };
      if (log.solved) {
        if (log.steps.some((s) => must.has(s.technique)))
          return { puzzle, solution, rating: ratePuzzle(new Grid(puzzle)), attempts, missing: 0, shape: summary(shapeOf(puzzle, allowed, group)) };
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
    if (spec.timeBudgetMs !== undefined && performance.now() - t0 > spec.timeBudgetMs * 4) return null;
  }
}

/** The counts the page shows about a generated puzzle. */
export interface ShapeSummary {
  clues: number;
  /** X-Wings, Skyscrapers, 2-String Kites and Turbot Fish. */
  hard: number;
  hiddenPairs: number;
  expert: number;
  extreme: number;
  locks: number;
}
const summary = (s: Shape): ShapeSummary => ({ clues: s.clues, hard: s.hard, hiddenPairs: s.hiddenPairs, expert: s.expert, extreme: s.extreme, locks: s.locks });

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
