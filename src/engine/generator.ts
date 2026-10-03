// A first, simple puzzle generator: random full grid, then remove clues one by one
// as long as the solution stays unique. Later this is where rating-based filtering goes.

import { PEERS, bit } from "./grid";
import { countSolutions } from "./solver";

function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Small seedable random generator (mulberry32), so puzzles can be reproduced from a seed. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSolution(rnd: () => number = Math.random): number[] {
  const v = new Array(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    let used = 0;
    for (const p of PEERS[i]) if (v[p]) used |= bit(v[p]);
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd)) {
      if (used & bit(d)) continue;
      v[i] = d;
      if (fill(i + 1)) return true;
    }
    v[i] = 0;
    return false;
  };
  fill(0);
  return v;
}

/** Generate a puzzle with a unique solution. `symmetric` removes clues in 180° rotational pairs. */
export function generatePuzzle(rnd: () => number = Math.random, symmetric = true): { puzzle: number[]; solution: number[] } {
  const solution = randomSolution(rnd);
  const puzzle = solution.slice();
  for (const i of shuffle([...Array(81).keys()], rnd)) {
    const j = 80 - i;
    if (!puzzle[i]) continue;
    const saved = [puzzle[i], puzzle[j]];
    puzzle[i] = 0;
    if (symmetric) puzzle[j] = 0;
    if (countSolutions(puzzle, 2).count !== 1) {
      puzzle[i] = saved[0];
      puzzle[j] = saved[1];
    }
  }
  return { puzzle, solution };
}
