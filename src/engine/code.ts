// Puzzle codes: a short text that contains the starting digits of a puzzle, so it
// can be shared and loaded anywhere. The code stores the puzzle itself (not a random
// seed), so it keeps working even when the generator or rating changes later.
//
// Format: one version letter followed by a base-62 number (0-9, A-Z, a-z).
//   "A": which of the 81 cells are given (81 bits), then the given digits.
//   "S": same, but for puzzles whose givens are 180° symmetric only the first
//        41 cells are stored, which makes the code about 7 characters shorter.
// The given digits are packed as one base-9 number (digit - 1), first cell first.

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const B62 = BigInt(62);

function toBase62(n: bigint): string {
  let s = "";
  do {
    s = ALPHABET[Number(n % B62)] + s;
    n /= B62;
  } while (n > 0n);
  return s;
}

function fromBase62(s: string): bigint {
  let n = 0n;
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`"${ch}" can't be part of a puzzle code.`);
    n = n * B62 + BigInt(v);
  }
  return n;
}

const isSymmetric = (values: number[]) => values.every((v, i) => !!v === !!values[80 - i]);

export function encodePuzzle(values: number[]): string {
  const symmetric = isSymmetric(values);
  const maskCells = symmetric ? 41 : 81;
  let mask = 0n;
  let digits = 0n;
  for (let i = 0; i < 81; i++) {
    if (!values[i]) continue;
    if (i < maskCells) mask |= 1n << BigInt(i);
    digits = digits * 9n + BigInt(values[i] - 1);
  }
  const n = (digits << BigInt(maskCells)) | mask;
  return (symmetric ? "S" : "A") + toBase62(n);
}

/** Decode a puzzle code into 81 values (0 = empty). Spaces and dashes are ignored. */
export function decodePuzzle(code: string): number[] {
  const clean = code.replace(/[\s-]+/g, "");
  const version = clean[0];
  if (version !== "A" && version !== "S") throw new Error("This doesn't look like a puzzle code.");
  const maskCells = version === "S" ? 41 : 81;
  const n = fromBase62(clean.slice(1));
  const mask = n & ((1n << BigInt(maskCells)) - 1n);
  let digits = n >> BigInt(maskCells);
  const given: number[] = [];
  for (let i = 0; i < maskCells; i++) if ((mask >> BigInt(i)) & 1n) given.push(i);
  // Symmetric codes: cells 0-39 have a mirror cell 80-i (cell 40 is the centre).
  if (version === "S") for (let i = 0; i < 40; i++) if ((mask >> BigInt(i)) & 1n) given.push(80 - i);
  given.sort((a, b) => a - b);
  const values = new Array(81).fill(0);
  for (let k = given.length - 1; k >= 0; k--) {
    values[given[k]] = Number(digits % 9n) + 1;
    digits /= 9n;
  }
  if (digits !== 0n) throw new Error("This puzzle code is damaged (too long).");
  return values;
}
