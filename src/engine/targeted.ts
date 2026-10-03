// Generating puzzles of a chosen difficulty that are not grindy.
//
// Strategy: make a random minimal puzzle and rate it.
//   - Right difficulty and grind allowed: done.
//   - Too hard or too grindy: give a clue back. The clue goes where the first
//     too-hard (or grindy) step of the solve path acts, so that step is no longer
//     needed. Rate again and repeat a few times. This turns many puzzles that would
//     be thrown away into usable ones.
//   - Too easy: throw it away and start over (removing more clues isn't possible,
//     the puzzle is already minimal).
//
// The search runs as a generator function that yields after every rating, so the
// interface can show progress and stay responsive.

import { generatePuzzle } from "./generator";
import { Grid } from "./grid";
import { logicalSolve } from "./hints";
import { DEFAULT_MAX_ALTERNATIVE, DIFFICULTIES, Difficulty, GrindVerdict, Rating, grindWeight, patternFirst, ratePuzzle } from "./rating";

export interface GenerateSpec {
  difficulty: Exclude<Difficulty, "Beyond">;
  /** Most grind allowed: "clean" (none) or "light" (one forced triple). */
  maxGrind: GrindVerdict;
  maxAlternative?: number;
  /** Keep clues in 180° rotational symmetry. */
  symmetric?: boolean;
  /** How many clues may be added back to a single puzzle. */
  maxAddedClues?: number;
}

export interface Generated {
  puzzle: number[];
  solution: number[];
  rating: Rating;
  /** Ratings performed in total. */
  attempts: number;
}

export interface GenerateProgress {
  attempts: number;
}

const rank = (d: Difficulty) => (d === "Beyond" ? DIFFICULTIES.length : DIFFICULTIES.indexOf(d));
const GRIND_RANK: Record<GrindVerdict, number> = { clean: 0, light: 1, heavy: 2 };

/** Level bounds for a difficulty label (inverse of difficultyLabel). */
const MAX_LEVEL: Record<string, number> = { Easy: 1, Medium: 3.5, Hard: 5.5, Expert: 7, Extreme: Infinity };

/**
 * The cell to give back as a clue: the target of the first step on the solve path
 * that is too hard or grindy, so that step becomes unnecessary.
 */
function clueToAdd(puzzle: number[], spec: GenerateSpec, maxAlt: number): number | null {
  const g = new Grid(puzzle);
  const log = logicalSolve(g, patternFirst(maxAlt));
  const limit = MAX_LEVEL[spec.difficulty];
  const bad = log.steps.find((s) => s.level > limit || grindWeight(s) > 0);
  if (bad) {
    const cells = [...bad.placements.map((p) => p.cell), ...bad.eliminations.map((e) => e.cell), ...bad.cells];
    const empty = cells.find((c) => !puzzle[c]);
    if (empty !== undefined) return empty;
  }
  // The techniques got stuck: give back a cell from the remaining empty ones.
  if (!log.solved) {
    const empty = log.final.values.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0 && !puzzle[i]);
    if (empty.length) return empty[Math.floor(empty.length / 2)];
  }
  return null;
}

export function* generateRated(spec: GenerateSpec, rnd: () => number = Math.random): Generator<GenerateProgress, Generated> {
  const maxAlt = spec.maxAlternative ?? DEFAULT_MAX_ALTERNATIVE;
  const target = rank(spec.difficulty);
  const maxAdded = spec.maxAddedClues ?? 6;
  let attempts = 0;
  for (;;) {
    const { puzzle, solution } = generatePuzzle(rnd, spec.symmetric ?? true);
    for (let added = 0; ; added++) {
      const rating = ratePuzzle(new Grid(puzzle), maxAlt);
      attempts++;
      yield { attempts };
      const r = rank(rating.difficulty);
      if (r < target) break; // too easy: start over
      const grindOk = GRIND_RANK[rating.grind] <= GRIND_RANK[spec.maxGrind];
      if (r === target && grindOk && rating.solved) return { puzzle, solution, rating, attempts };
      if (added >= maxAdded) break;
      const c = clueToAdd(puzzle, spec, maxAlt);
      if (c === null) break;
      puzzle[c] = solution[c];
      // Keep the symmetry when the partner cell is empty too.
      if (spec.symmetric ?? true) {
        const p = 80 - c;
        if (!puzzle[p]) puzzle[p] = solution[p];
      }
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
