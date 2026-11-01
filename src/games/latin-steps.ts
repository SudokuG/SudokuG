// Steps shared by the Latin-square puzzles (Futoshiki, Calcudoku): every row and column holds
// 1..n once. The state keeps, per cell, a mask of the digits still possible (bit d = digit d).
import { bitsOf, cellName, describeEliminations, listJoin, onlyBit, popcount } from "./logic";
import type { CellValue, LiteStep } from "./logic";

export interface LatinState {
  dom: number[];
  placed: boolean[];
}

/** A step finder: a step, "contradiction" when the state can't be right, or null. */
export type LatinFinder = (p: { n: number }, s: LatinState) => LiteStep | "contradiction" | null;

const linesCache = new Map<number, { name: string; cells: number[] }[]>();
export function linesOf(n: number) {
  const hit = linesCache.get(n);
  if (hit) return hit;
  const out: { name: string; cells: number[] }[] = [];
  for (let r = 0; r < n; r++) out.push({ name: `row ${r + 1}`, cells: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) out.push({ name: `column ${c + 1}`, cells: Array.from({ length: n }, (_, r) => r * n + c) });
  linesCache.set(n, out);
  return out;
}

export const cloneLatin = (s: LatinState): LatinState => ({ dom: s.dom.slice(), placed: s.placed.slice() });

export function placeLatin(p: { n: number }, s: LatinState, cell: number, v: number): void {
  const n = p.n;
  s.dom[cell] = 1 << v;
  s.placed[cell] = true;
  const r = Math.floor(cell / n);
  const c = cell % n;
  for (let k = 0; k < n; k++) {
    if (r * n + k !== cell) s.dom[r * n + k] &= ~(1 << v);
    if (k * n + c !== cell) s.dom[k * n + c] &= ~(1 << v);
  }
}

export const single: LatinFinder = (p, s) => {
  for (let i = 0; i < s.dom.length; i++) {
    if (!s.dom[i]) return "contradiction";
    if (!s.placed[i] && popcount(s.dom[i]) === 1) {
      const v = onlyBit(s.dom[i]);
      return {
        technique: "Single",
        level: 1,
        weight: 0,
        placements: [{ cell: i, value: v }],
        eliminations: [],
        region: [i],
        nudge: "One cell has only one digit left.",
        explanation: `Every other digit is ruled out for ${cellName(p.n, i)}, so it is ${v}.`,
      };
    }
  }
  return null;
};

export const hiddenSingle: LatinFinder = (p, s) => {
  for (const line of linesOf(p.n))
    for (let d = 1; d <= p.n; d++) {
      const at = line.cells.filter((c) => s.dom[c] & (1 << d));
      if (!at.length) return "contradiction";
      if (at.length === 1 && !s.placed[at[0]])
        return {
          technique: "Hidden Single",
          level: 1,
          weight: 0,
          placements: [{ cell: at[0], value: d }],
          eliminations: [],
          region: line.cells,
          nudge: `Look for a digit with only one place left in ${line.name}.`,
          explanation: `In ${line.name}, the ${d} can only go in ${cellName(p.n, at[0])}.`,
        };
    }
  return null;
};

/** Naked and hidden subsets of a size in each line. */
export const subsets =
  (k: number): LatinFinder =>
  (p, s) => {
    const n = p.n;
    const name = k === 2 ? "Pair" : "Triple";
    for (const line of linesOf(n)) {
      const open = line.cells.filter((c) => !s.placed[c]);
      const choose = (arr: number[], size: number, start = 0, acc: number[] = []): number[][] =>
        acc.length === size ? [acc.slice()] : arr.slice(start).flatMap((x, i) => choose(arr, size, start + i + 1, [...acc, x]));
      // Naked: k cells holding only k digits between them.
      for (const cells of choose(open, k)) {
        const union = cells.reduce((m, c) => m | s.dom[c], 0);
        if (popcount(union) !== k) continue;
        const elims: CellValue[] = [];
        for (const c of open) if (!cells.includes(c)) for (const v of bitsOf(s.dom[c] & union)) elims.push({ cell: c, value: v });
        if (!elims.length) continue;
        return {
          technique: `Naked ${name}`,
          level: k === 2 ? 3 : 3.5,
          weight: k === 2 ? 4 : 6,
          placements: [],
          eliminations: elims,
          region: line.cells,
          nudge: `Look for ${k} cells in ${line.name} that share ${k} digits.`,
          explanation: `In ${line.name}, ${listJoin(cells.map((c) => cellName(n, c)))} can only hold ${listJoin(bitsOf(union).map(String))} between them, so those digits go there and nowhere else in the ${line.name.split(" ")[0]}: ${describeEliminations(n, elims)}.`,
          parts: [{ elims, text: `${listJoin(cells.map((c) => cellName(n, c)))} hold ${listJoin(bitsOf(union).map(String))} between them, so ${describeEliminations(n, elims).replace(/can't be/g, "isn't")}` }],
        };
      }
      // Hidden: k digits with only k places between them.
      const missing = Array.from({ length: n }, (_, d) => d + 1).filter((d) => !line.cells.some((c) => s.placed[c] && s.dom[c] === 1 << d));
      for (const ds of choose(missing, k)) {
        const mask = ds.reduce((m, d) => m | (1 << d), 0);
        const at = open.filter((c) => s.dom[c] & mask);
        if (at.length !== k) continue;
        const elims: CellValue[] = [];
        for (const c of at) for (const v of bitsOf(s.dom[c] & ~mask)) elims.push({ cell: c, value: v });
        if (!elims.length) continue;
        return {
          technique: `Hidden ${name}`,
          level: k === 2 ? 3 : 3.5,
          weight: k === 2 ? 4 : 6,
          placements: [],
          eliminations: elims,
          region: line.cells,
          nudge: `Look for ${k} digits that have the same ${k} places left in ${line.name}.`,
          explanation: `In ${line.name}, ${listJoin(ds.map(String))} can only go in ${listJoin(at.map((c) => cellName(n, c)))}, so those cells hold just them: ${describeEliminations(n, elims)}.`,
          parts: [{ elims, text: `${listJoin(ds.map(String))} can only go in ${listJoin(at.map((c) => cellName(n, c)))} in ${line.name}, so ${describeEliminations(n, elims).replace(/can't be/g, "isn't")}` }],
        };
      }
    }
    return null;
  };


/**
 * X-Wing: in two rows, a digit can only go in the same two columns. Whichever way it goes,
 * those two columns get their copy of the digit from these rows, so the rest of the two
 * columns can't hold it (and the same with rows and columns swapped).
 */
export const xWing: LatinFinder = (p, s) => {
  const n = p.n;
  const lines = linesOf(n);
  for (const [base, cross] of [
    ["row", "column"],
    ["column", "row"],
  ] as const) {
    const own = lines.filter((l) => l.name.startsWith(base));
    const other = lines.filter((l) => l.name.startsWith(cross));
    for (let d = 1; d <= n; d++) {
      const b = 1 << d;
      // For each line, the positions (index across) where d can still go, if exactly two.
      const two = own.map((l) => {
        if (l.cells.some((c) => s.placed[c] && s.dom[c] === b)) return null;
        const at = l.cells.map((c, k) => (!s.placed[c] && s.dom[c] & b ? k : -1)).filter((k) => k >= 0);
        return at.length === 2 ? at : null;
      });
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const a = two[i];
          const c = two[j];
          if (!a || !c || a[0] !== c[0] || a[1] !== c[1]) continue;
          const elims: CellValue[] = [];
          for (const k of a)
            for (const cell of other[k].cells)
              if (!own[i].cells.includes(cell) && !own[j].cells.includes(cell) && !s.placed[cell] && s.dom[cell] & b) elims.push({ cell, value: d });
          if (!elims.length) continue;
          const corners = [own[i].cells[a[0]], own[i].cells[a[1]], own[j].cells[a[0]], own[j].cells[a[1]]];
          const where = `${base}s ${i + 1} and ${j + 1}`;
          const cols = `${cross}s ${a[0] + 1} and ${a[1] + 1}`;
          return {
            technique: "X-Wing",
            level: 4,
            weight: 7,
            placements: [],
            eliminations: elims,
            region: [...new Set([...corners, ...elims.map((e) => e.cell)])],
            nudge: `Look at where the ${d}s can go in ${where}.`,
            explanation: `In ${where}, the ${d} can only go in ${cols} (${listJoin(corners.map((x) => cellName(n, x)))}). Whichever way it goes, both ${cross}s get their ${d} from these two ${base}s, so ${describeEliminations(n, elims)}.`,
            parts: [{ elims, premise: corners, text: `in ${where} the ${d} can only go in ${cols} (an X-Wing), so ${listJoin(elims.map((e) => cellName(n, e.cell)))} ${elims.length === 1 ? "isn't" : "aren't"} ${d}` }],
          };
        }
    }
  }
  return null;
};

/** Why a state can't be right: a cell with nothing left, or a digit with no place in a line. */
export function latinWhy(p: { n: number }, s: LatinState): { text: string; cells: number[] } | null {
  const n = p.n;
  for (let i = 0; i < n * n; i++) if (!s.dom[i]) return { text: `${cellName(n, i)} would have no digit left`, cells: [i] };
  for (const line of linesOf(n))
    for (let d = 1; d <= n; d++) if (!line.cells.some((c) => s.dom[c] & (1 << d))) return { text: `the ${d} would have no place left in ${line.name}`, cells: line.cells };
  return null;
}

const sharesLine = (n: number, a: number, b: number) => Math.floor(a / n) === Math.floor(b / n) || a % n === b % n;

/**
 * Explain a trial: what follows from the assumption, up to the contradiction. Keeps the steps
 * that lead to it (working back from the cells of the contradiction), at most `max`.
 */
export function trialChain(n: number, steps: LiteStep[], why: { text: string; cells: number[] }, doms?: number[][], max = 10): string[] {
  const premise = new Set(why.cells);
  const out: string[] = [];
  const lineOf = (cells: number[]) => {
    if (cells.length < 2) return "";
    if (cells.every((c) => Math.floor(c / n) === Math.floor(cells[0] / n))) return `row ${Math.floor(cells[0] / n) + 1}`;
    if (cells.every((c) => c % n === cells[0] % n)) return `column ${(cells[0] % n) + 1}`;
    return "";
  };
  // A placement matters when it is a cell the chain relies on, or takes its digit away from
  // one (a cell in the same line that could still hold it; an X counts for the whole line).
  const matters = (k: number, pl: CellValue) =>
    [...premise].some((c) => c === pl.cell || (sharesLine(n, c, pl.cell) && (!doms || pl.value === 0 || (doms[k][c] & (1 << pl.value)) !== 0)));
  const because = (st: LiteStep, pl: CellValue) => {
    if (st.technique === "Single") return pl.value === 0 ? "" : ", its only digit left";
    if (st.technique === "Hidden Single") {
      const line = lineOf(st.region);
      return line && pl.value ? `, the only place for ${pl.value} in ${line}` : "";
    }
    return "";
  };
  for (let k = steps.length - 1; k >= 0; k--) {
    const st = steps[k];
    const placed = st.placements.filter((pl) => matters(k, pl));
    const parts = (st.parts ?? [{ elims: st.eliminations, text: st.explanation.replace(/\.$/, "") }]).filter((pt) => pt.elims.some((e) => premise.has(e.cell)));
    if (!placed.length && !parts.length) continue;
    if (placed.length) out.unshift(...placed.map((pl) => `${cellName(n, pl.cell)} would be ${pl.value === 0 ? "an X" : pl.value}${because(st, pl)}`));
    else out.unshift(...parts.map((pt) => pt.text));
    st.region.forEach((c) => premise.add(c));
    st.placements.forEach((pl) => premise.add(pl.cell));
  }
  // A long chain shows its end (where it breaks); the start is left out.
  return out.length > max ? ["…", ...out.slice(-max)] : out;
}

/**
 * Trial for the Latin-square puzzles: assume a digit in a cell (fewest candidates first) and
 * follow the easier steps; if that hits a contradiction, the digit can go. The explanation
 * shows the chain of steps and where it breaks.
 */
export function latinTrial<P extends { n: number }>(
  p: P,
  s: LatinState,
  easiest: (p: P, s: LatinState) => LiteStep | "contradiction" | null,
  apply: (p: P, s: LatinState, st: LiteStep) => void,
  why: (p: P, s: LatinState) => { text: string; cells: number[] } | null,
  weight = 20,
): LiteStep | null {
  const n = p.n;
  const cells = s.dom.map((d, i) => [i, popcount(d)]).filter(([i, k]) => !s.placed[i] && k > 1).sort((a, b) => a[1] - b[1]);
  // Of the first few digits that break, show the one with the shortest chain.
  let best: { i: number; v: number; chain: string[]; reason: { text: string; cells: number[] } } | null = null;
  let found = 0;
  search: for (const [i] of cells)
    for (const v of bitsOf(s.dom[i])) {
      const t = cloneLatin(s);
      placeLatin(p, t, i, v);
      const steps: LiteStep[] = [];
      const doms: number[][] = [];
      let broken = false;
      for (let k = 0; k < 600; k++) {
        if (t.placed.every(Boolean)) break;
        const st = easiest(p, t);
        if (st === "contradiction") {
          broken = true;
          break;
        }
        if (!st) break;
        steps.push(st);
        doms.push([...t.dom]);
        apply(p, t, st);
      }
      if (!broken) continue;
      const reason = why(p, t) ?? { text: "the puzzle would break", cells: [] };
      const chain = trialChain(n, steps, reason, doms);
      if (!best || chain.length < best.chain.length) best = { i, v, chain, reason };
      if (++found >= 4 || chain.length <= 3) break search;
    }
  if (!best) return null;
  const { i, v, chain, reason } = best;
  const name = cellName(n, i);
  const said = chain.length ? `Then ${chain.join("; ")}; and then ${reason.text}.` : `Then at once ${reason.text}.`;
  return {
    technique: "Trial",
    level: 5,
    weight,
    placements: [],
    eliminations: [{ cell: i, value: v }],
    region: [i, ...reason.cells],
    nudge: `Try ${v} in ${name} and follow where it leads.`,
    explanation: `Suppose ${name} were ${v}. ${said} That can't be, so ${name} isn't ${v}.`,
    parts: [{ elims: [{ cell: i, value: v }], text: `${v} in ${name} would lead to a contradiction (${reason.text}), so ${name} isn't ${v}` }],
  };
}
