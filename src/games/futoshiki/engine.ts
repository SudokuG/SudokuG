// Futoshiki: an n×n grid where every row and column holds 1..n once, with "greater than"
// signs between some neighbouring cells (and a few given digits).
//
// Puzzles are made on the spot: a random Latin square; then every sign and no givens, plus
// givens where two solutions still differ; then signs and givens are taken away in random
// order (givens first) as long as the solution stays unique. Easy keeps some extra clues.

import { linesHold, packB62, randomLatin, shuffle, unpackB62 } from "../latin";

export interface FutoshikiPuzzle {
  n: number;
  /** The solution, row by row (digits 1..n). */
  solution: number[];
  givens: boolean[];
  /** Which neighbour pairs show a sign, in the order of pairsOf(n). */
  signs: boolean[];
}

export const FUTOSHIKI_SIZES: Record<string, number> = { Easy: 5, Medium: 6, Hard: 7 };

/** Neighbour pairs: first the horizontal ones (left, right), then the vertical ones (top, bottom). */
const pairCache = new Map<number, [number, number][]>();
export function pairsOf(n: number): [number, number][] {
  const hit = pairCache.get(n);
  if (hit) return hit;
  const out: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c + 1 < n; c++) out.push([r * n + c, r * n + c + 1]);
  for (let r = 0; r + 1 < n; r++) for (let c = 0; c < n; c++) out.push([r * n + c, (r + 1) * n + c]);
  pairCache.set(n, out);
  return out;
}

/** Signs as [smaller cell, larger cell]. */
export function inequalities(p: FutoshikiPuzzle): [number, number][] {
  return pairsOf(p.n)
    .filter((_, k) => p.signs[k])
    .map(([a, b]) => (p.solution[a] < p.solution[b] ? [a, b] : [b, a]));
}

const popcount = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};
const lowest = (m: number) => 31 - Math.clz32(m & -m);
const highest = (m: number) => 31 - Math.clz32(m);

/**
 * Count solutions (up to `limit`) of an n×n Futoshiki with these inequalities ([smaller,
 * larger]) and known cells (0 = unknown). Constraint propagation plus backtracking on the
 * cell with the fewest candidates. Candidates are bits 1..n.
 */
export function solveFutoshiki(n: number, less: [number, number][], known: number[], limit = 2): { count: number; solutions: number[][] } {
  const all = ((1 << (n + 1)) - 1) & ~1;
  const solutions: number[][] = [];
  let count = 0;
  const lines: number[][] = [];
  for (let i = 0; i < n; i++) {
    lines.push(Array.from({ length: n }, (_, c) => i * n + c));
    lines.push(Array.from({ length: n }, (_, r) => r * n + i));
  }
  const cellLines: number[][][] = Array.from({ length: n * n }, (_, i) => [lines[2 * Math.floor(i / n)], lines[2 * (i % n) + 1]]);

  /** Narrow the candidates until nothing changes; false on a contradiction. */
  const propagate = (d: number[]): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      for (let i = 0; i < n * n; i++) {
        if (!d[i]) return false;
        if (popcount(d[i]) === 1)
          for (const line of cellLines[i])
            for (const j of line)
              if (j !== i && d[j] & d[i]) {
                d[j] &= ~d[i];
                if (!d[j]) return false;
                changed = true;
              }
      }
      // Hidden singles: a digit with one place left in a line.
      for (const line of lines)
        for (let v = 1; v <= n; v++) {
          const b = 1 << v;
          let at = -1;
          let k = 0;
          for (const j of line) if (d[j] & b) (at = j), k++;
          if (k === 0) return false;
          if (k === 1 && d[at] !== b) {
            d[at] = b;
            changed = true;
          }
        }
      for (const [a, b] of less) {
        // a < b: a below the largest of b, b above the smallest of a.
        const na = d[a] & ((1 << highest(d[b])) - 1);
        const nb = d[b] & ~((1 << (lowest(d[a]) + 1)) - 1);
        if (!na || !nb) return false;
        if (na !== d[a] || nb !== d[b]) {
          d[a] = na;
          d[b] = nb;
          changed = true;
        }
      }
    }
    return true;
  };

  const search = (d: number[]): void => {
    if (count >= limit || !propagate(d)) return;
    let best = -1;
    for (let i = 0; i < n * n; i++) if (popcount(d[i]) > 1 && (best < 0 || popcount(d[i]) < popcount(d[best]))) best = i;
    if (best < 0) {
      count++;
      solutions.push(d.map(lowest));
      return;
    }
    for (let m = d[best]; m && count < limit; m &= m - 1) {
      const next = d.slice();
      next[best] = m & -m;
      search(next);
    }
  };
  search(known.map((v) => (v ? 1 << v : all)));
  return { count, solutions };
}

export function generateFutoshiki(n: number, rnd: () => number, extra = 0): FutoshikiPuzzle {
  const solution = randomLatin(n, rnd).map((s) => s + 1);
  const pairs = pairsOf(n);
  const p: FutoshikiPuzzle = { n, solution, givens: new Array(n * n).fill(false), signs: new Array(pairs.length).fill(true) };
  const unique = () => solveFutoshiki(n, inequalities(p), solution.map((v, i) => (p.givens[i] ? v : 0)), 2);
  // All signs; add givens where two solutions differ until one is left.
  for (;;) {
    const r = unique();
    if (r.count === 1) break;
    const [a, b] = r.solutions;
    p.givens[shuffle([...Array(n * n).keys()].filter((i) => a[i] !== b[i]), rnd)[0]] = true;
  }
  // Take away givens first (puzzles should lean on the signs), then signs.
  for (const i of shuffle([...Array(n * n).keys()].filter((i) => p.givens[i]), rnd)) {
    p.givens[i] = false;
    if (unique().count !== 1) p.givens[i] = true;
  }
  for (const k of shuffle([...pairs.keys()], rnd)) {
    p.signs[k] = false;
    if (unique().count !== 1) p.signs[k] = true;
  }
  // Easier puzzles: give back a few clues (signs and digits).
  for (let k = 0; k < extra; k++) {
    if (rnd() < 0.5) {
      const off = [...pairs.keys()].filter((j) => !p.signs[j]);
      if (off.length) p.signs[off[Math.floor(rnd() * off.length)]] = true;
    } else {
      const off = [...Array(n * n).keys()].filter((i) => !p.givens[i]);
      if (off.length) p.givens[off[Math.floor(rnd() * off.length)]] = true;
    }
  }
  return p;
}

// ---------------------------------------------------------------------------
// Codes: "F6-<solution>-<givens>-<signs>", each packed into base 62. A sign's direction
// follows from the solution.

export function encodeFutoshiki(p: FutoshikiPuzzle): string {
  return `F${p.n}-${packB62(p.solution.map((v) => v - 1), p.n)}-${packB62(p.givens.map(Number), 2)}-${packB62(p.signs.map(Number), 2)}`;
}

export const isFutoshikiCode = (s: string) => /^F[3-9]-[0-9A-Za-z]+-[0-9A-Za-z]+-[0-9A-Za-z]+$/.test(s.trim());

export function decodeFutoshiki(code: string): FutoshikiPuzzle {
  const m = /^F([3-9])-([0-9A-Za-z]+)-([0-9A-Za-z]+)-([0-9A-Za-z]+)$/.exec(code.trim());
  if (!m) throw new Error("Not a Futoshiki code.");
  const n = Number(m[1]);
  const solution = unpackB62(m[2], n, n * n).map((v) => v + 1);
  if (!linesHold(n, (i) => solution[i], Array.from({ length: n }, (_, k) => k + 1))) throw new Error("This code doesn't hold a valid Futoshiki grid.");
  return { n, solution, givens: unpackB62(m[3], 2, n * n).map(Boolean), signs: unpackB62(m[4], 2, pairsOf(n).length).map(Boolean) };
}
