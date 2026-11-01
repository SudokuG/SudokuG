// Star Battle: an n×n grid cut into n regions. Every row, column and region holds k stars
// (1 on the smaller boards, 2 on 10×10), and no two stars touch, not even diagonally.
//
// A puzzle is made from its answer: random stars first (k per row and column, never
// touching), then regions grown around them (each region starts from its k stars), then
// cells are moved between neighbouring regions until the stars are the only solution.

import { packB62, shuffle, unpackB62 } from "../latin";

export const STAR_SIZES = [6, 8, 10] as const;

/** Stars per row, column and region on an n×n board. */
export const starsFor = (n: number) => (n >= 9 ? 2 : 1);

export interface StarPuzzle {
  n: number;
  /** Stars per row, column and region. */
  k: number;
  /** The region of each cell (0..n-1, numbered in reading order of their first cell). */
  regionOf: number[];
  /** The cells of each region, in reading order. */
  regions: number[][];
  /** 1 = star, 0 = empty. */
  solution: number[];
  /** No cell is ever given. */
  givens: boolean[];
}

/** The 8 cells around cell i. */
export function around(n: number, i: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
    }
  return out;
}

/** The 4 cells beside cell i (regions are connected through these). */
function beside(n: number, i: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

export const touching = (n: number, a: number, b: number) => a !== b && Math.abs(Math.floor(a / n) - Math.floor(b / n)) <= 1 && Math.abs((a % n) - (b % n)) <= 1;

/** Build a puzzle from its stars and regions (renumbers the regions in reading order). */
export function buildStars(n: number, solution: number[], regionOf: number[]): StarPuzzle {
  const order = new Map<number, number>();
  for (const r of regionOf) if (!order.has(r)) order.set(r, order.size);
  const ro = regionOf.map((r) => order.get(r)!);
  const regions: number[][] = Array.from({ length: order.size }, () => []);
  ro.forEach((r, i) => regions[r].push(i));
  return { n, k: starsFor(n), regionOf: ro, regions, solution, givens: new Array(n * n).fill(false) };
}

/** Random stars: k per row and column, none touching. Null when the search runs dry. */
export function randomStars(n: number, k: number, rnd: () => number): number[] | null {
  const cols = new Array(n).fill(0);
  const rows: number[][] = [];
  // Every way to put k stars in one row without them touching.
  const combos: number[][] = [];
  const pick = (from: number, acc: number[]) => {
    if (acc.length === k) return void combos.push(acc.slice());
    for (let c = from; c < n; c++) {
      acc.push(c);
      pick(c + 2, acc);
      acc.pop();
    }
  };
  pick(0, []);
  let budget = 20000;
  const go = (r: number): boolean => {
    if (r === n) return cols.every((x) => x === k);
    if (--budget < 0) return false;
    const left = n - r - 1;
    for (const cs of shuffle(combos.slice(), rnd)) {
      if (cs.some((c) => cols[c] >= k)) continue;
      if (r > 0 && cs.some((c) => rows[r - 1].some((d) => Math.abs(c - d) <= 1))) continue;
      cs.forEach((c) => cols[c]++);
      // Every column must still be able to reach k (at most one star per two rows).
      if (cols.every((x) => x + Math.ceil(left / 2) >= k)) {
        rows[r] = cs;
        if (go(r + 1)) return true;
      }
      cs.forEach((c) => cols[c]--);
    }
    return false;
  };
  if (!go(0)) return null;
  const sol = new Array(n * n).fill(0);
  rows.forEach((cs, r) => cs.forEach((c) => (sol[r * n + c] = 1)));
  return sol;
}

/**
 * Regions grown around the stars: each region starts from its k stars (with 2 stars, the
 * two are joined by a short path first), then the free cells are handed out one at a time
 * to a neighbouring region, smaller regions more likely. Null when two stars can't be joined.
 */
export function growRegions(n: number, k: number, sol: number[], rnd: () => number, skew = 0): number[] | null {
  const region = new Array(n * n).fill(-1);
  const stars = sol.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (k === 1) stars.forEach((s, r) => (region[s] = r));
  else {
    // Pair each star with a near free star, nearest pairs first (with a little randomness).
    const free = new Set(stars);
    let r = 0;
    for (const a of shuffle(stars.slice(), rnd)) {
      if (!free.has(a)) continue;
      free.delete(a);
      const dist = (b: number) => Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs((a % n) - (b % n)) + rnd() * 1.5;
      const b = [...free].sort((x, y) => dist(x) - dist(y))[0];
      if (b === undefined) return null;
      free.delete(b);
      // Shortest path from a to b through cells nobody has yet (not other stars).
      const prev = new Map<number, number>([[a, -1]]);
      const queue = [a];
      for (let q = 0; q < queue.length && !prev.has(b); q++)
        for (const j of shuffle(beside(n, queue[q]), rnd)) {
          if (prev.has(j) || region[j] >= 0 || (sol[j] && j !== b)) continue;
          prev.set(j, queue[q]);
          queue.push(j);
        }
      if (!prev.has(b)) return null;
      for (let x = b; x !== -1; x = prev.get(x)!) region[x] = r;
      r++;
    }
  }
  const size = new Array(n).fill(0);
  region.forEach((r) => r >= 0 && size[r]++);
  // How eagerly each region grows: with skew, some regions stay small (small regions pin
  // their stars down early, which makes easier puzzles).
  const eager = size.map(() => Math.pow(rnd(), skew));
  for (;;) {
    const options: [number, number][] = [];
    for (let i = 0; i < n * n; i++) {
      if (region[i] >= 0) continue;
      for (const j of beside(n, i)) if (region[j] >= 0) options.push([i, region[j]]);
    }
    if (!options.length) break;
    // Smaller regions grow more often, so sizes stay mixed but not wild.
    const w = options.map(([, r]) => (eager[r] + 0.02) / (size[r] * size[r]));
    let x = rnd() * w.reduce((a, b) => a + b, 0);
    let k2 = 0;
    while (k2 < options.length - 1 && (x -= w[k2]) > 0) k2++;
    const [i, r] = options[k2];
    region[i] = r;
    size[r]++;
  }
  return region.every((r) => r >= 0) ? region : null;
}

/**
 * Count the solutions (up to `limit`), row by row. Returns the solutions found.
 */
export function starSolutions(p: Pick<StarPuzzle, "n" | "k" | "regionOf">, limit = 2, fixed?: number[]): number[][] {
  const { n, k, regionOf } = p;
  const combos: number[][] = [];
  const pick = (from: number, acc: number[]) => {
    if (acc.length === k) return void combos.push(acc.slice());
    for (let c = from; c < n; c++) {
      acc.push(c);
      pick(c + 2, acc);
      acc.pop();
    }
  };
  pick(0, []);
  // How many more stars each region can get from row r on (at most k per row, ignoring touching).
  const capFrom: number[][] = Array.from({ length: n + 1 }, () => new Array(n).fill(0));
  for (let r = n - 1; r >= 0; r--) {
    const inRow = new Array(n).fill(0);
    for (let c = 0; c < n; c++) inRow[regionOf[r * n + c]]++;
    for (let g = 0; g < n; g++) capFrom[r][g] = capFrom[r + 1][g] + Math.min(k, Math.ceil(inRow[g] / 2));
  }
  const cols = new Array(n).fill(0);
  const regs = new Array(n).fill(0);
  const rows: number[][] = [];
  const out: number[][] = [];
  let budget = 400000;
  const go = (r: number) => {
    if (out.length >= limit || --budget < 0) return;
    if (r === n) {
      if (regs.every((x) => x === k)) {
        const s = new Array(n * n).fill(0);
        rows.forEach((cs, rr) => cs.forEach((c) => (s[rr * n + c] = 1)));
        out.push(s);
      }
      return;
    }
    const left = n - r - 1;
    for (const cs of combos) {
      if (fixed && cs.some((c) => fixed[r * n + c] === 0)) continue;
      if (fixed && fixed.slice(r * n, r * n + n).some((v, c) => v === 1 && !cs.includes(c))) continue;
      if (cs.some((c) => cols[c] >= k)) continue;
      if (r > 0 && cs.some((c) => rows[r - 1].some((d) => Math.abs(c - d) <= 1))) continue;
      let ok = true;
      for (const c of cs) if (++regs[regionOf[r * n + c]] > k) ok = false;
      cs.forEach((c) => cols[c]++);
      if (ok && cols.every((x) => x + Math.ceil(left / 2) >= k))
        for (let g = 0; g < n && ok; g++) if (regs[g] + capFrom[r + 1][g] < k) ok = false;
      if (ok) {
        rows[r] = cs;
        go(r + 1);
      }
      cs.forEach((c) => {
        cols[c]--;
        regs[regionOf[r * n + c]]--;
      });
      if (out.length >= limit) return;
    }
  };
  go(0);
  return out;
}

/** True when the cells of region g (as numbered in `region`) are connected without cell `skip`. */
function connectedWithout(n: number, region: number[], g: number, skip: number): boolean {
  const cells = region.map((r, i) => (r === g && i !== skip ? i : -1)).filter((i) => i >= 0);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]);
  const queue = [cells[0]];
  for (let q = 0; q < queue.length; q++)
    for (const j of beside(n, queue[q])) if (j !== skip && region[j] === g && !seen.has(j)) (seen.add(j), queue.push(j));
  return seen.size === cells.length;
}

/**
 * Make the stars the only solution: while another solution exists, move one of its stars
 * (a cell that is empty in ours) into a neighbouring region, which breaks that solution and
 * keeps ours. Null when it gets stuck.
 */
export function uniquify(n: number, k: number, sol: number[], region: number[], rnd: () => number, rounds = 80): number[] | null {
  region = region.slice();
  for (let t = 0; t < rounds; t++) {
    const found = starSolutions({ n, k, regionOf: region }, 2);
    const other = found.find((s) => s.some((v, i) => v !== sol[i]));
    if (!other) return found.length === 1 ? region : null;
    const moves: [number, number][] = [];
    for (let i = 0; i < n * n; i++) {
      if (!other[i] || sol[i]) continue;
      const g = region[i];
      for (const j of beside(n, i)) if (region[j] !== g && !moves.some(([a, b]) => a === i && b === region[j])) moves.push([i, region[j]]);
    }
    let moved = false;
    for (const [i, to] of shuffle(moves, rnd)) {
      if (!connectedWithout(n, region, region[i], i)) continue;
      region[i] = to;
      moved = true;
      break;
    }
    if (!moved) return null;
  }
  return null;
}

/** A random puzzle with one solution (any difficulty), or null when this try fails. */
export function randomStarPuzzle(n: number, rnd: () => number, skew = 0): StarPuzzle | null {
  const k = starsFor(n);
  const sol = randomStars(n, k, rnd);
  if (!sol) return null;
  const grown = growRegions(n, k, sol, rnd, skew);
  if (!grown) return null;
  const region = uniquify(n, k, sol, grown, rnd);
  return region ? buildStars(n, sol, region) : null;
}

// ---- Codes: B8-<regions>-<stars> ------------------------------------------------------

export function encodeStars(p: StarPuzzle): string {
  return `B${p.n}-${packB62(p.regionOf, p.n)}-${packB62(p.solution, 2)}`;
}

export const isStarCode = (s: string) => /^B(\d{1,2})-[0-9A-Za-z]+-[0-9A-Za-z]+$/.test(s.trim());

export function decodeStars(code: string): StarPuzzle {
  const m = /^B(\d{1,2})-([0-9A-Za-z]+)-([0-9A-Za-z]+)$/.exec(code.trim());
  if (!m) throw new Error("Not a Star Battle code.");
  const n = Number(m[1]);
  if (n < 4 || n > 12) throw new Error("Not a Star Battle size.");
  const k = starsFor(n);
  const regionOf = unpackB62(m[2], n, n * n);
  const solution = unpackB62(m[3], 2, n * n);
  const p = buildStars(n, solution, regionOf);
  const ok =
    p.regions.length === n &&
    p.regions.every((cells) => cells.filter((i) => solution[i]).length === k) &&
    Array.from({ length: n }, (_, r) => solution.slice(r * n, r * n + n).reduce((a, b) => a + b, 0)).every((x) => x === k) &&
    Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => solution[r * n + c]).reduce((a, b) => a + b, 0)).every((x) => x === k) &&
    solution.every((v, i) => !v || around(n, i).every((j) => !solution[j]));
  if (!ok) throw new Error("This code doesn't hold a valid Star Battle.");
  return p;
}
