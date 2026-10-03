// Brute-force backtracking solver (no human logic).
// Used to check that a puzzle has exactly one solution, to verify hints,
// and later by the generator.

import { ALL, PEERS, bit, popcount } from "./grid";

export interface SolveResult {
  /** 0, 1 or 2 (2 means "two or more") */
  count: number;
  /** The first solution found, if any. */
  solution: number[] | null;
}

/**
 * Count solutions of a puzzle given as 81 values (0 = empty), stopping at `limit`.
 * Optional `cands` restricts which digits each empty cell may take
 * (used to detect wrongly removed candidates).
 */
export function countSolutions(values: number[], limit = 2, cands?: number[]): SolveResult {
  const v = values.slice();
  // Reject puzzles that already contain a conflict.
  for (let i = 0; i < 81; i++) {
    if (!v[i]) continue;
    for (const p of PEERS[i]) if (v[p] === v[i]) return { count: 0, solution: null };
  }
  const allowed = new Array(81).fill(ALL);
  if (cands) for (let i = 0; i < 81; i++) if (!v[i]) allowed[i] = cands[i];

  let count = 0;
  let solution: number[] | null = null;

  const options = (i: number) => {
    let m = allowed[i];
    for (const p of PEERS[i]) if (v[p]) m &= ~bit(v[p]);
    return m;
  };

  const search = (): boolean => {
    // Pick the empty cell with the fewest options (MRV heuristic).
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (v[i]) continue;
      const m = options(i);
      const c = popcount(m);
      if (c === 0) return false;
      if (c < bestCount) {
        best = i;
        bestMask = m;
        bestCount = c;
        if (c === 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = v.slice();
      return count >= limit;
    }
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & bit(d))) continue;
      v[best] = d;
      if (search()) return true;
    }
    v[best] = 0;
    return false;
  };

  search();
  return { count, solution };
}

/** The unique solution, or null when the puzzle has none or several. */
export function uniqueSolution(values: number[]): number[] | null {
  const r = countSolutions(values, 2);
  return r.count === 1 ? r.solution : null;
}
