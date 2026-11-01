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
  /** The step in short pieces (what each rules out, and why), for hints that chain steps. */
  parts?: { elims: CellValue[]; text: string; /** Cells the piece relies on (default: the step's region). */ premise?: number[] }[];
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

/** An old cell value: a dot ("a digit goes here"). Now a RING candidate; kept to read old saves. */
export const DOT = -2;

/**
 * Candidates are bitmasks: bit d for digit d, bit 0 for "may still be an X". RING alone is an
 * empty ring: a digit goes here, which one isn't noted. Digit candidates without bit 0 also
 * say "not an X".
 */
export const RING = 1 << 15;

/** What a cell's candidates still allow (bit 0 = X), or null when nothing is noted. */
export function allowedBy(cands: number, digits: number): number | null {
  if (!cands) return null;
  if (cands === RING) return digits;
  return cands & ~RING;
}

/** The step-by-step solver of a puzzle type, as the hints and auto-finish use it. */
export interface LiteSolver<S extends { dom: number[]; placed: boolean[] }> {
  start(): S;
  place(s: S, cell: number, value: number): void;
  next(s: S): LiteStep | null;
  apply(s: S, step: LiteStep): void;
}

interface Entries {
  n: number;
  solution: number[];
  givens: boolean[];
  cells: number[];
  cands: number[];
  /** Digits of the puzzle as a mask (bits 1..m). */
  digits: number;
}

/** The solver state for the player's grid: their entries placed, their candidates as limits. */
function stateFrom<S extends { dom: number[]; placed: boolean[] }>(o: LiteSolver<S>, e: Entries, useCands = true): S {
  const s = o.start();
  e.cells.forEach((v, i) => !e.givens[i] && v >= 0 && o.place(s, i, v));
  if (useCands)
    e.cells.forEach((v, i) => {
      if (s.placed[i]) return;
      const allowed = allowedBy(e.cands[i], e.digits);
      if (allowed !== null) s.dom[i] &= allowed;
    });
  return s;
}

/**
 * When everything left follows from singles (no candidates needed): the cells and values to
 * fill in, in order. Null when it needs more, or when an entry is wrong.
 */
export function singlesFinish<S extends { dom: number[]; placed: boolean[] }>(o: LiteSolver<S>, e: Entries): { cell: number; value: number }[] | null {
  if (e.cells.some((v, i) => v >= 0 && v !== e.solution[i])) return null;
  const s = stateFrom(o, e, false);
  const out: { cell: number; value: number }[] = [];
  for (let k = 0; k < 200 && !s.placed.every(Boolean); k++) {
    const st = o.next(s);
    if (!st || st.level > 1 || !st.placements.length) return null;
    out.push(...st.placements);
    o.apply(s, st);
  }
  return s.placed.every(Boolean) ? out : null;
}

const STEP_WORDS: Record<string, string> = {
  Sign: "the signs",
  "Naked Pair": "a pair",
  "Hidden Pair": "a pair",
  "Naked Triple": "a triple",
  "Hidden Triple": "a triple",
  Trial: "trying a digit",
};

/**
 * What the final placement needed, in short pieces: the pieces that ruled out what it relies
 * on (the other values of its cell, or its value in the other cells of its line), then the
 * pieces those relied on (anything about the cells they looked at).
 */
function neededParts(steps: LiteStep[], final: LiteStep): string[] {
  const pl = final.placements[0];
  const others = new Set(final.region.filter((c) => c !== pl.cell));
  const direct = (e: CellValue) => (final.region.length <= 1 ? e.cell === pl.cell : e.value === pl.value && others.has(e.cell));
  const premise = new Set<number>();
  const out: string[] = [];
  for (let k = steps.length - 1; k >= 0; k--) {
    const st = steps[k];
    const parts = st.parts ?? [{ elims: st.eliminations, text: st.explanation.replace(/\.$/, "") }];
    const used = parts.filter((pt) => pt.elims.some((e) => direct(e) || premise.has(e.cell)));
    if (!used.length) continue;
    out.unshift(...used.map((pt) => pt.text));
    for (const pt of used) ("premise" in pt && pt.premise ? pt.premise : st.region).forEach((c) => premise.add(c));
  }
  return [...new Set(out)];
}

/**
 * The next hint for the player's grid: first any mistakes (wrong entries, a ring on an X,
 * candidates that leave out the right value), then the easiest step from what is there.
 * With `toPlacement`, the hint goes straight to the next value that can be placed and
 * explains the steps it needs, so it works without candidates written down.
 */
export function liteHint<S extends { dom: number[]; placed: boolean[] }>(o: LiteSolver<S>, e: Entries, toPlacement = false): LiteHint {
  const { n, solution, givens, cells, cands } = e;
  const names = (is: number[]) => listJoin(is.map((i) => cellName(n, i)));
  const wrong = cells.map((v, i) => (!givens[i] && v >= 0 && v !== solution[i] ? i : -1)).filter((i) => i >= 0);
  if (wrong.length)
    return { kind: "error", cells: wrong, message: `${wrong.length === 1 ? "This entry isn't" : "These entries aren't"} right: ${names(wrong)}. Undo or erase before going on.` };
  const lost = cells
    .map((v, i) => {
      const allowed = v < 0 ? allowedBy(cands[i], e.digits) : null;
      return allowed !== null && !(allowed & (1 << solution[i])) ? i : -1;
    })
    .filter((i) => i >= 0);
  if (lost.length) {
    const xs = lost.filter((i) => solution[i] === 0);
    const what = xs.length === lost.length ? "say it isn't an X, but it is" : "leave out what belongs there";
    return { kind: "error", cells: lost, message: `The marks in ${names(lost)} ${what}. Fix them, or clear those candidates.` };
  }
  if (cells.every((v) => v >= 0)) return { kind: "solved", message: "The puzzle is solved." };
  const s = stateFrom(o, e);
  if (!toPlacement) {
    const step = o.next(s);
    if (!step) return { kind: "stuck", message: "No step found from here. Check your entries, or try Reveal." };
    o.apply(s, step);
    return { kind: "step", step, after: s.dom };
  }
  const before: LiteStep[] = [];
  for (let k = 0; k < 300; k++) {
    const st = o.next(s);
    if (!st) break;
    o.apply(s, st);
    if (!st.placements.length) {
      before.push(st);
      continue;
    }
    const needed = neededParts(before, st);
    if (!needed.length) return { kind: "step", step: st, after: s.dom };
    const used = before.filter((x) => (x.parts ?? []).some((pt) => needed.includes(pt.text)) || needed.includes(x.explanation.replace(/\.$/, "")));
    const pl = st.placements[0];
    const where = cellName(n, pl.cell);
    const tools = listJoin([...new Set(used.map((x) => STEP_WORDS[x.technique] ?? x.technique.toLowerCase()))]);
    const shown = needed.slice(-8);
    const single = st.region.length <= 1;
    const reasons = `${needed.length > shown.length ? "…; " : ""}${shown.join("; ")}.`;
    return {
      kind: "step",
      after: s.dom,
      step: {
        technique: `${st.technique}, using ${tools}`,
        level: Math.max(st.level, ...used.map((x) => x.level)),
        weight: 0,
        placements: st.placements,
        eliminations: [],
        region: [...new Set([...used.flatMap((x) => x.region), ...st.region])],
        nudge: single ? `${where} can be filled in: ${tools} rule out the other digits.` : `${st.nudge} Use ${tools} to rule out the other places.`,
        explanation: `${reasons} So ${st.explanation[0].toLowerCase()}${st.explanation.slice(1)}`,
      },
    };
  }
  return { kind: "stuck", message: "No step found from here. Check your entries, or try Reveal." };
}
