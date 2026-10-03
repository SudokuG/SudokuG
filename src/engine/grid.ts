// Grid model: 81 cells (index 0..80, row-major), digits 1..9.
// Candidates are stored as 9-bit masks: bit (d-1) set means digit d is possible.

export const ALL = 0x1ff;

export const bit = (d: number): number => 1 << (d - 1);

/** Number of set bits in a candidate mask. */
export function popcount(m: number): number {
  let c = 0;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
}

/** Digits contained in a mask, ascending. */
export function digitsOf(m: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d);
  return out;
}

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

export type UnitKind = "row" | "column" | "box";
export interface Unit {
  kind: UnitKind;
  index: number; // 0..8
  cells: number[];
}

/** The 27 units: rows 0-8, columns 0-8, boxes 0-8 (in that order). */
export const UNITS: Unit[] = (() => {
  const units: Unit[] = [];
  for (let r = 0; r < 9; r++)
    units.push({ kind: "row", index: r, cells: Array.from({ length: 9 }, (_, c) => r * 9 + c) });
  for (let c = 0; c < 9; c++)
    units.push({ kind: "column", index: c, cells: Array.from({ length: 9 }, (_, r) => r * 9 + c) });
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    const cells: number[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((r0 + r) * 9 + c0 + c);
    units.push({ kind: "box", index: b, cells });
  }
  return units;
})();

export const ROWS = UNITS.slice(0, 9);
export const COLS = UNITS.slice(9, 18);
export const BOXES = UNITS.slice(18, 27);

/** For each cell, the 20 other cells that share a row, column or box. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>();
  for (const u of [ROWS[rowOf(i)], COLS[colOf(i)], BOXES[boxOf(i)]]) for (const j of u.cells) if (j !== i) s.add(j);
  return [...s];
});

/** Human-readable cell name, e.g. "r3c7". */
export const cellName = (i: number) => `r${rowOf(i) + 1}c${colOf(i) + 1}`;
export const unitName = (u: Unit) => `${u.kind} ${u.index + 1}`;

/** Compact list of cells, e.g. "r1c2, r1c5 and r1c8". */
export function cellList(cells: number[]): string {
  const names = [...cells].sort((a, b) => a - b).map(cellName);
  return listJoin(names);
}

export function listJoin(items: (string | number)[]): string {
  const s = items.map(String);
  if (s.length <= 1) return s.join("");
  return s.slice(0, -1).join(", ") + " and " + s[s.length - 1];
}

export class Grid {
  /** 0 = empty, otherwise 1..9 */
  values: number[];
  /** Candidate masks; only meaningful for empty cells. */
  cands: number[];

  constructor(values: number[], cands?: number[]) {
    this.values = values.slice();
    this.cands = cands ? cands.slice() : new Array(81).fill(0);
    if (!cands) this.fillCandidates();
  }

  /** Parse an 81-character string; 0 or . (or any non-digit) means empty. Whitespace is ignored. */
  static fromString(s: string): Grid {
    const clean = s.replace(/\s+/g, "");
    if (clean.length !== 81) throw new Error(`Expected 81 characters, got ${clean.length}.`);
    const values = [...clean].map((ch) => (ch >= "1" && ch <= "9" ? Number(ch) : 0));
    return new Grid(values);
  }

  toString(): string {
    return this.values.map((v) => (v ? String(v) : ".")).join("");
  }

  clone(): Grid {
    return new Grid(this.values, this.cands);
  }

  /** Digits already placed among the peers of cell i, as a mask. */
  peerMask(i: number): number {
    let m = 0;
    for (const p of PEERS[i]) if (this.values[p]) m |= bit(this.values[p]);
    return m;
  }

  /** Set every empty cell's candidates to the digits not placed among its peers. */
  fillCandidates(): void {
    for (let i = 0; i < 81; i++) this.cands[i] = this.values[i] ? 0 : ALL & ~this.peerMask(i);
  }

  /** Place a digit and remove it from the candidates of all peers. */
  place(i: number, d: number): void {
    this.values[i] = d;
    this.cands[i] = 0;
    for (const p of PEERS[i]) this.cands[p] &= ~bit(d);
  }

  eliminate(i: number, d: number): void {
    this.cands[i] &= ~bit(d);
  }

  isSolved(): boolean {
    return this.values.every((v) => v !== 0);
  }

  /** Cells that hold the same digit as a peer. */
  conflicts(): Set<number> {
    const bad = new Set<number>();
    for (let i = 0; i < 81; i++) {
      const v = this.values[i];
      if (!v) continue;
      for (const p of PEERS[i]) if (this.values[p] === v) bad.add(i);
    }
    return bad;
  }
}
