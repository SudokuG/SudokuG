// Puzzle rating: how hard a puzzle is, and how "grindy".
//
// Two kinds of moves count as grind:
//   - Triples and quads (naked and hidden): you can only find them by writing down
//     every candidate and searching every row, column and box.
//   - Chains that use three or more different digits: following them is close to
//     solving the puzzle in your head, more trial than pattern.
// Using one now and then is fine. A puzzle becomes grindy when, at some point, a
// grindy move is the ONLY reasonable way forward.
//
// To find those moments the puzzle is solved twice:
//   1. Easiest first: always the easiest available move (the normal hint order).
//      This gives the classic difficulty: the hardest technique you can't avoid.
//   2. Patterns first: techniques up to a chosen level (by default up to Expert:
//      fish, wings, coloring, Swordfish) are tried first, then triples and quads,
//      then the remaining non-grindy techniques (one- and two-digit chains, Jellyfish),
//      and long multi-digit chains last of all. A grindy move on this path means no
//      reasonable alternative worked at that moment: that is "forced grind".
//
// Note: naked and hidden subsets mirror each other. In a unit with k empty cells,
// a naked triple is the same deduction as a hidden subset of size k-3. Because
// pairs are tried before triples, a triple is only ever reported when the unit
// has 6 or more empty cells, and a quad only with 8 or more. So every triple or
// quad the engine reports really needed a wide search.

import { Grid, UNITS, cellName, unitName } from "./grid";
import { applyStep, logicalSolve } from "./hints";
import { TECHNIQUES } from "./techniques";
import type { Step, Technique } from "./types";

/** Grind added by a forced triple or quad. */
export const SUBSET_WEIGHT: Record<string, number> = {
  "Naked Triple": 1,
  "Hidden Triple": 1,
  "Naked Quad": 2,
  "Hidden Quad": 2,
};

/** Chains with at least this many different digits count as grind. */
export const GRINDY_CHAIN_DIGITS = 3;
/** Grind added by a forced long chain. */
export const CHAIN_WEIGHT = 2;
/** Techniques that can produce chains with many digits. */
const MULTI_DIGIT_CHAINS = new Set(["XY-Chain", "Alternating Inference Chain"]);

/** Grind weight of a single step (0 = not grindy). */
export function grindWeight(step: Step): number {
  if (step.technique in SUBSET_WEIGHT) return SUBSET_WEIGHT[step.technique];
  if ((step.chainDigits ?? 0) >= GRINDY_CHAIN_DIGITS) return CHAIN_WEIGHT;
  return 0;
}

export const isGrindyStep = (step: Step) => grindWeight(step) > 0;

/** Hardest technique that still counts as a fair alternative to a triple or quad (Expert). */
export const DEFAULT_MAX_ALTERNATIVE = 7;

/**
 * Technique order for the patterns-first path and the "prefer patterns" hint option:
 * patterns up to `maxAlternative`, then triples and quads, then other non-grindy
 * techniques, then multi-digit chains.
 */
export function patternFirst(maxAlternative = DEFAULT_MAX_ALTERNATIVE): Technique[] {
  const subset = (t: Technique) => t.name in SUBSET_WEIGHT;
  const longChain = (t: Technique) => MULTI_DIGIT_CHAINS.has(t.name);
  const pattern = (t: Technique) => !subset(t) && !longChain(t) && t.level <= maxAlternative;
  return [
    ...TECHNIQUES.filter(pattern),
    ...TECHNIQUES.filter(subset),
    ...TECHNIQUES.filter((t) => !subset(t) && !longChain(t) && !pattern(t)),
    ...TECHNIQUES.filter(longChain),
  ];
}

export const PATTERN_FIRST = patternFirst();

export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Expert", "Extreme"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number] | "Beyond";

/** Difficulty labels by level of the hardest technique needed. */
export function difficultyLabel(level: number | null, solved: boolean): Difficulty {
  if (!solved) return "Beyond";
  if (level === null || level <= 1) return "Easy";
  if (level <= 3.5) return "Medium";
  if (level <= 5.5) return "Hard";
  if (level <= 7) return "Expert";
  return "Extreme";
}

export interface ForcedGrind {
  /** Step number on the patterns-first path (1-based). */
  step: number;
  technique: string;
  kind: "subset" | "chain";
  /** Where it happened, e.g. "row 4" or "from r1c1 to r8c1". */
  where: string;
  /** Subsets: empty cells in that unit at that moment. */
  emptyInUnit?: number;
  /** Chains: number of different digits. */
  digits?: number;
  /** Empty cells left in the whole grid at that moment. */
  emptyInGrid: number;
  weight: number;
}

export type GrindVerdict = "clean" | "light" | "heavy";

export interface Rating {
  /** Can the current techniques solve it? */
  solved: boolean;
  /** Steps on the easiest-first path. */
  steps: number;
  /** Hardest technique on the easiest-first path (the classic difficulty). */
  hardest: { technique: string; level: number } | null;
  /** Hardest non-grindy technique on the patterns-first path. */
  hardestPatternFirst: { technique: string; level: number } | null;
  difficulty: Difficulty;
  /** Moments where a grindy move was the only reasonable way forward. */
  forced: ForcedGrind[];
  /** Sum of the weights of the forced moments. */
  grindScore: number;
  grind: GrindVerdict;
  /** How often the easiest-first path used a grindy move (forced or not). */
  grindOnEasiestPath: number;
  /** Technique counts on the easiest-first path. */
  counts: Record<string, number>;
  /** The same, as a list sorted from easiest to hardest technique. */
  used: { technique: string; level: number; count: number }[];
}

const hardestOf = (steps: Step[]) =>
  steps.reduce<{ technique: string; level: number } | null>(
    (h, s) => (!h || s.level > h.level ? { technique: s.technique, level: s.level } : h),
    null,
  );

export function grindVerdict(score: number): GrindVerdict {
  if (score === 0) return "clean";
  if (score === 1) return "light";
  return "heavy";
}

export function ratePuzzle(start: Grid, maxAlternative = DEFAULT_MAX_ALTERNATIVE): Rating {
  const easy = logicalSolve(start);
  const pattern = logicalSolve(start, patternFirst(maxAlternative));

  // Replay the patterns-first path to record where the forced grind happened.
  const g = start.clone();
  const forced: ForcedGrind[] = [];
  pattern.steps.forEach((s, i) => {
    const weight = grindWeight(s);
    if (weight) {
      const base = { step: i + 1, technique: s.technique, emptyInGrid: g.values.filter((v) => !v).length, weight };
      if (s.technique in SUBSET_WEIGHT) {
        const unit = UNITS[s.units[0]];
        forced.push({ ...base, kind: "subset", where: unitName(unit), emptyInUnit: unit.cells.filter((c) => !g.values[c]).length });
      } else {
        const first = s.candidates[0].cell;
        const last = s.candidates[s.candidates.length - 1].cell;
        forced.push({ ...base, kind: "chain", where: `from ${cellName(first)} to ${cellName(last)}`, digits: s.chainDigits });
      }
    }
    applyStep(g, s);
  });

  const grindScore = forced.reduce((sum, f) => sum + f.weight, 0);
  const hardest = hardestOf(easy.steps);
  return {
    solved: easy.solved,
    steps: easy.steps.length,
    hardest,
    hardestPatternFirst: hardestOf(pattern.steps.filter((s) => !isGrindyStep(s))),
    difficulty: difficultyLabel(hardest?.level ?? null, easy.solved),
    forced,
    grindScore,
    grind: grindVerdict(grindScore),
    grindOnEasiestPath: easy.steps.filter(isGrindyStep).length,
    counts: easy.counts,
    used: Object.entries(easy.counts)
      .map(([technique, count]) => ({ technique, count, level: easy.steps.find((s) => s.technique === technique)!.level }))
      .sort((a, b) => a.level - b.level),
  };
}
