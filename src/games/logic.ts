// Shared by the step-by-step solvers of the lighter puzzle types: what one logical step is,
// and how hints and ratings use them.
//
// The solvers keep, for every cell, a mask of what is still possible: bit 0 for an X (in
// types that have X's), bit d for digit d. A cell is "placed" once the player (or a step)
// filled it in; placing a digit removes it from the rest of its row and column.

export interface CellValue {
  cell: number;
  /** 0 = X, otherwise a digit. */
  value: number;
}

export interface LiteStep {
  technique: string;
  /** Higher is harder (1: singles … 5: trying a candidate). */
  level: number;
  placements: CellValue[];
  eliminations: CellValue[];
  /** Cells to shade (the row, column or cells the step looks at). */
  region: number[];
  /** Short teaser (first hint click). */
  nudge: string;
  /** Full explanation (second click). */
  explanation: string;
  /** How much the step asks of you (for ratings): 0 for singles, more for longer reasoning. */
  weight: number;
}

export const cellName = (n: number, i: number) => `r${Math.floor(i / n) + 1}c${(i % n) + 1}`;
export const valueName = (v: number) => (v === 0 ? "X" : String(v));

/** "a, b and c" */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const popcount = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};
export const onlyBit = (m: number) => 31 - Math.clz32(m);
export const bitsOf = (m: number) => {
  const out: number[] = [];
  for (let b = 0; m >> b; b++) if (m & (1 << b)) out.push(b);
  return out;
};

/** Describe eliminations per cell: "r3c4 can't be 2 or 5". */
export function describeEliminations(n: number, elims: CellValue[]): string {
  const by = new Map<number, number[]>();
  for (const e of elims) by.set(e.cell, [...(by.get(e.cell) ?? []), e.value]);
  return listJoin([...by].map(([c, vs]) => `${cellName(n, c)} can't be ${listJoin(vs.map(valueName)).replace(/ and /g, " or ")}`));
}

export type LiteHint =
  | { kind: "step"; step: LiteStep; /** What is still possible per cell after the step. */ after: number[] }
  | { kind: "error"; message: string; cells: number[] }
  | { kind: "solved"; message: string }
  | { kind: "stuck"; message: string };

/** Cell entries on the page: -1 empty, -2 a dot ("a digit goes here", types with X's), 0 X, or a digit. */
export const DOT = -2;

/**
 * The next hint for the player's grid: first any mistakes (wrong entries, a dot on an X,
 * candidates that leave out the right digit), then the easiest step from what is filled in.
 * Candidates only limit the digits (bit 0 is a note for X and rules nothing out).
 */
export function liteHint<S extends { dom: number[]; placed: boolean[] }>(o: {
  n: number;
  solution: number[];
  givens: boolean[];
  cells: number[];
  cands: number[];
  start: () => S;
  place: (s: S, cell: number, value: number) => void;
  next: (s: S) => LiteStep | null;
  apply: (s: S, step: LiteStep) => void;
}): LiteHint {
  const { n, solution, givens, cells, cands } = o;
  const names = (is: number[]) => listJoin(is.map((i) => cellName(n, i)));
  const wrong = cells.map((v, i) => (!givens[i] && v >= 0 && v !== solution[i]) || (v === DOT && solution[i] === 0) ? i : -1).filter((i) => i >= 0);
  if (wrong.length)
    return { kind: "error", cells: wrong, message: `${wrong.length === 1 ? "This entry isn't" : "These entries aren't"} right: ${names(wrong)}. Undo or erase before going on.` };
  const lost = cells.map((v, i) => (v < 0 && cands[i] & ~1 && solution[i] > 0 && !(cands[i] & (1 << solution[i])) ? i : -1)).filter((i) => i >= 0);
  if (lost.length)
    return { kind: "error", cells: lost, message: `The candidates in ${names(lost)} leave out the digit that belongs there. Add it back, or clear those candidates.` };
  if (cells.every((v) => v >= 0)) return { kind: "solved", message: "The puzzle is solved." };
  const s = o.start();
  cells.forEach((v, i) => !givens[i] && v >= 0 && o.place(s, i, v));
  cells.forEach((v, i) => {
    if (s.placed[i]) return;
    if (v === DOT) s.dom[i] &= ~1;
    if (cands[i] & ~1) s.dom[i] &= cands[i] | 1;
  });
  const step = o.next(s);
  if (!step) return { kind: "stuck", message: "No step found from here. Check your entries, or try Reveal cell." };
  o.apply(s, step);
  return { kind: "step", step, after: s.dom };
}
