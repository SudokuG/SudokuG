// Treasure Map: the strict form of the puzzle known as Japanese Sums (in Denksport Logisch
// "Japans vierkant"):
//   - an n×n grid; every row and column holds the digits 1 to n-2 exactly once and two X's;
//   - the numbers left of each row and above each column are the sums of the runs of
//     digits in that line, in order (runs are separated by X's), as in a nonogram.
// With n = 7 that is digits 1-5 and two X's per line; a line without X's inside has a
// single run of 15.
//
// Puzzles are made on the spot: a random grid, its clues, and a solver that counts
// solutions. When the clues alone allow more than one solution, cells are given away
// where two solutions differ, until only one is left; then givens that turn out not to be
// needed are taken back.

import { linesHold, packB62, randomLatin, shuffle, unpackB62 } from "../latin";

/** 0 = X, otherwise a digit. */
export type Cell = number;

export interface SumsPuzzle {
  n: number;
  /** The solution, row by row (n*n cells, 0 = X). */
  solution: Cell[];
  /** Cells shown at the start (true = given). */
  givens: boolean[];
  rowClues: number[][];
  colClues: number[][];
}

export const SUMS_SIZES = [6, 7, 8];

/** Sums of the runs of digits in a line (0 = X). */
export function runSums(line: Cell[]): number[] {
  const out: number[] = [];
  let sum = 0;
  let open = false;
  for (const v of line) {
    if (v) {
      sum += v;
      open = true;
    } else if (open) {
      out.push(sum);
      sum = 0;
      open = false;
    }
  }
  if (open) out.push(sum);
  return out;
}

export function cluesOf(n: number, solution: Cell[]): { rowClues: number[][]; colClues: number[][] } {
  const rowClues: number[][] = [];
  const colClues: number[][] = [];
  for (let i = 0; i < n; i++) {
    rowClues.push(runSums(solution.slice(i * n, i * n + n)));
    colClues.push(runSums(Array.from({ length: n }, (_, r) => solution[r * n + i])));
  }
  return { rowClues, colClues };
}

/** A random grid: a random Latin square on n symbols, with two of the symbols turned into X's. */
export function randomGrid(n: number, rnd: () => number): Cell[] {
  // Symbols 0 and 1 become X's; 2..n-1 become the digits 1..n-2.
  return randomLatin(n, rnd).map((s) => (s < 2 ? 0 : s - 1));
}

/** Every possible line: two X's and the digits 1..n-2 once each. */
const lineCache = new Map<number, Cell[][]>();
function allLines(n: number): Cell[][] {
  const hit = lineCache.get(n);
  if (hit) return hit;
  const m = n - 2;
  const perms: number[][] = [];
  const permute = (a: number[], k: number) => {
    if (k === a.length) return void perms.push(a.slice());
    for (let i = k; i < a.length; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      permute(a, k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  };
  permute(Array.from({ length: m }, (_, i) => i + 1), 0);
  const out: Cell[][] = [];
  for (let x1 = 0; x1 < n; x1++)
    for (let x2 = x1 + 1; x2 < n; x2++)
      for (const p of perms) {
        const line: Cell[] = [];
        let k = 0;
        for (let i = 0; i < n; i++) line.push(i === x1 || i === x2 ? 0 : p[k++]);
        out.push(line);
      }
  lineCache.set(n, out);
  return out;
}

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Count solutions (stopping at `limit`), filling rows top to bottom from the lines that
 * match each row clue, and checking columns as they grow. `known` holds given cells
 * (-1 = unknown, 0 = X, digit). Returns the count and up to `limit` solutions.
 */
export function solveSums(n: number, rowClues: number[][], colClues: number[][], known: number[], limit = 2): { count: number; solutions: Cell[][] } {
  const lines = allLines(n);
  const rows = rowClues.map((clue, r) =>
    lines.filter((l) => {
      for (let c = 0; c < n; c++) {
        const k = known[r * n + c];
        if (k >= 0 && l[c] !== k) return false;
      }
      return sameList(runSums(l), clue);
    }),
  );
  const grid: Cell[][] = [];
  const solutions: Cell[][] = [];
  // Column state: digits used, X's so far, sum of the open run, index of the run being filled.
  const used = new Array(n).fill(0);
  const xs = new Array(n).fill(0);
  const run = new Array(n).fill(0);
  const idx = new Array(n).fill(0);
  let count = 0;
  const place = (r: number): void => {
    if (count >= limit) return;
    if (r === n) {
      for (let c = 0; c < n; c++) {
        const done = idx[c] + (run[c] ? 1 : 0);
        if (done !== colClues[c].length || (run[c] && run[c] !== colClues[c][idx[c]])) return;
      }
      count++;
      solutions.push(grid.flat());
      return;
    }
    for (const line of rows[r]) {
      let ok = true;
      const saved = [used.slice(), xs.slice(), run.slice(), idx.slice()];
      for (let c = 0; c < n && ok; c++) {
        const v = line[c];
        if (v) {
          if (used[c] & (1 << v)) ok = false;
          else {
            used[c] |= 1 << v;
            run[c] += v;
            if (idx[c] >= colClues[c].length || run[c] > colClues[c][idx[c]]) ok = false;
          }
        } else {
          if (++xs[c] > 2) ok = false;
          else if (run[c]) {
            if (run[c] !== colClues[c][idx[c]]) ok = false;
            idx[c]++;
            run[c] = 0;
          }
        }
      }
      if (ok) {
        grid.push(line);
        place(r + 1);
        grid.pop();
      }
      used.splice(0, n, ...saved[0]);
      xs.splice(0, n, ...saved[1]);
      run.splice(0, n, ...saved[2]);
      idx.splice(0, n, ...saved[3]);
      if (count >= limit) return;
    }
  };
  place(0);
  return { count, solutions };
}

/** A puzzle of size n with exactly one solution (givens added only where needed). */
export function generateSums(n: number, rnd: () => number): SumsPuzzle {
  const solution = randomGrid(n, rnd);
  const { rowClues, colClues } = cluesOf(n, solution);
  const givens = new Array(n * n).fill(false);
  const known = () => solution.map((v, i) => (givens[i] ? v : -1));
  // Give away a cell where two solutions differ, until one solution is left.
  for (;;) {
    const r = solveSums(n, rowClues, colClues, known(), 2);
    if (r.count === 1) break;
    const [a, b] = r.solutions;
    const diff = shuffle([...Array(n * n).keys()].filter((i) => a[i] !== b[i]), rnd);
    givens[diff[0]] = true;
  }
  // Take back givens that are not needed.
  for (const i of shuffle([...Array(n * n).keys()].filter((i) => givens[i]), rnd)) {
    givens[i] = false;
    if (solveSums(n, rowClues, colClues, known(), 2).count !== 1) givens[i] = true;
  }
  return { n, solution, givens, rowClues, colClues };
}

// ---------------------------------------------------------------------------
// Codes: "J7-<solution>-<givens>", both packed into base 62. The clues follow from the solution.

export function encodeSums(p: SumsPuzzle): string {
  return `J${p.n}-${packB62(p.solution, p.n - 1)}-${packB62(p.givens.map(Number), 2)}`;
}

export const isSumsCode = (s: string) => /^J[5-9]-[0-9A-Za-z]+-[0-9A-Za-z]+$/.test(s.trim());

export function decodeSums(code: string): SumsPuzzle {
  const m = /^J([5-9])-([0-9A-Za-z]+)-([0-9A-Za-z]+)$/.exec(code.trim());
  if (!m) throw new Error("Not a Treasure Map code.");
  const n = Number(m[1]);
  const solution: Cell[] = unpackB62(m[2], n - 1, n * n);
  const givens = unpackB62(m[3], 2, n * n).map(Boolean);
  if (!linesHold(n, (i) => solution[i], Array.from({ length: n - 2 }, (_, k) => k + 1)) || !linesHold(n, (i) => (solution[i] ? 0 : 1), [1, 1]))
    throw new Error("This code doesn't hold a valid Treasure Map grid.");
  return { n, solution, givens, ...cluesOf(n, solution) };
}
