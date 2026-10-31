// Shared by the lighter puzzle types: random Latin squares, shuffling and base-62 codes.

export const shuffle = <T>(a: T[], rnd: () => number): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** A random Latin square: n×n, row by row, symbols 0..n-1, each once per row and column. */
export function randomLatin(n: number, rnd: () => number): number[] {
  const g = new Array(n * n).fill(-1);
  const fill = (i: number): boolean => {
    if (i === n * n) return true;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const s of shuffle([...Array(n).keys()], rnd)) {
      let ok = true;
      for (let k = 0; k < n && ok; k++) if (g[r * n + k] === s || g[k * n + c] === s) ok = false;
      if (!ok) continue;
      g[i] = s;
      if (fill(i + 1)) return true;
    }
    g[i] = -1;
    return false;
  };
  fill(0);
  return g;
}

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Numbers (each 0..base-1) packed into one base-62 string. */
export function packB62(values: number[], base: number): string {
  let x = 0n;
  for (const v of values) x = x * BigInt(base) + BigInt(v);
  let s = "";
  do {
    s = B62[Number(x % 62n)] + s;
    x /= 62n;
  } while (x > 0n);
  return s;
}

/** The reverse of packB62: `count` numbers in 0..base-1. Throws on characters outside base 62. */
export function unpackB62(s: string, base: number, count: number): number[] {
  let x = 0n;
  for (const ch of s) {
    const v = B62.indexOf(ch);
    if (v < 0) throw new Error("Not a puzzle code.");
    x = x * 62n + BigInt(v);
  }
  const out = new Array<number>(count);
  for (let i = count - 1; i >= 0; i--) {
    out[i] = Number(x % BigInt(base));
    x /= BigInt(base);
  }
  return out;
}

/** True when each row and column of an n×n grid (given as `digit(i)`) holds `want` once each. */
export function linesHold(n: number, digit: (i: number) => number, want: number[]): boolean {
  const key = [...want].sort((a, b) => a - b).join();
  for (let i = 0; i < n; i++) {
    const row = Array.from({ length: n }, (_, c) => digit(i * n + c)).filter(Boolean);
    const col = Array.from({ length: n }, (_, r) => digit(r * n + i)).filter(Boolean);
    for (const line of [row, col]) if ([...line].sort((a, b) => a - b).join() !== key) return false;
  }
  return true;
}
