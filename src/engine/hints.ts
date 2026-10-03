// Hints and step-by-step logical solving built on top of the techniques.

import { Grid, cellList, cellName } from "./grid";
import { TECHNIQUES } from "./techniques";
import type { Step, Technique } from "./types";

export type Hint =
  | { kind: "step"; step: Step }
  | { kind: "error"; message: string; cells: number[] }
  | { kind: "stuck"; message: string }
  | { kind: "solved"; message: string };

/**
 * Find the next move a human would make.
 * If the solution is known, mistakes (wrong digits, wrongly removed candidates)
 * are reported first, since logic built on a mistake leads nowhere useful.
 * `techniques` sets the order in which techniques are tried (see PATTERN_FIRST in rating.ts).
 */
export function getHint(g: Grid, solution?: number[] | null, techniques: Technique[] = TECHNIQUES): Hint {
  const conflicts = [...g.conflicts()];
  if (conflicts.length)
    return { kind: "error", message: `Some digits clash with each other: ${cellList(conflicts)}.`, cells: conflicts };

  if (solution) {
    const wrong = [];
    for (let i = 0; i < 81; i++) if (g.values[i] && g.values[i] !== solution[i]) wrong.push(i);
    if (wrong.length)
      return {
        kind: "error",
        message: `${wrong.length === 1 ? "This digit is" : "These digits are"} not correct: ${cellList(wrong)}. Undo or erase before going on.`,
        cells: wrong,
      };
    const lost = [];
    for (let i = 0; i < 81; i++) if (!g.values[i] && !(g.cands[i] & (1 << (solution[i] - 1)))) lost.push(i);
    if (lost.length)
      return {
        kind: "error",
        message: `The candidates in ${cellList(lost)} no longer include the correct digit. Use Undo, or add the candidate back.`,
        cells: lost,
      };
  }

  for (let i = 0; i < 81; i++)
    if (!g.values[i] && g.cands[i] === 0)
      return { kind: "error", message: `${cellName(i)} has no candidates left, so something went wrong earlier.`, cells: [i] };

  if (g.isSolved()) return { kind: "solved", message: "The puzzle is solved." };

  for (const t of techniques) {
    const step = t.find(g);
    if (step) return { kind: "step", step };
  }
  return {
    kind: "stuck",
    message:
      "None of the techniques built so far applies here. This position needs something harder, such as forcing chains, finned fish or uniqueness techniques.",
  };
}

/** Apply a step to a grid (in place). */
export function applyStep(g: Grid, step: Step): void {
  for (const e of step.eliminations) g.eliminate(e.cell, e.digit);
  for (const p of step.placements) g.place(p.cell, p.digit);
}

export interface SolveLog {
  steps: Step[];
  solved: boolean;
  /** The grid where the techniques ran out, if they did. */
  final: Grid;
  /** Hardest technique used, by level. */
  hardest: Step | null;
  /** How many times each technique was used. */
  counts: Record<string, number>;
}

/**
 * Solve a puzzle step by step using only the techniques, always taking the
 * first available move in `techniques` order (easiest first by default).
 */
export function logicalSolve(start: Grid, techniques: Technique[] = TECHNIQUES): SolveLog {
  const g = start.clone();
  const steps: Step[] = [];
  for (;;) {
    if (g.isSolved()) break;
    const h = getHint(g, null, techniques);
    if (h.kind !== "step") break;
    steps.push(h.step);
    applyStep(g, h.step);
  }
  const counts: Record<string, number> = {};
  let hardest: Step | null = null;
  for (const s of steps) {
    counts[s.technique] = (counts[s.technique] ?? 0) + 1;
    if (!hardest || s.level > hardest.level) hardest = s;
  }
  return { steps, solved: g.isSolved(), final: g, hardest, counts };
}
