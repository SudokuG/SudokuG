// Star Battle, solved the way a person does, step by step, easiest first: hints, rating and
// making puzzles of a size and level.
//
// Every cell keeps a mask of what is still possible: bit 0 = empty, bit 1 = star. A unit is
// a row, a column or a region; each needs k stars. The steps:
//   1. Around a Star (the cells around a star are empty), Full Unit (a unit with its stars:
//      the rest is empty), Last Cells (as many cells left as stars needed: all stars).
//   2. Shared Neighbour: a cell touching every cell left for a unit's last star is empty.
//      Confined Unit: a region whose open cells all lie in one row (or column) that needs as
//      many stars takes all of that line's stars, so the rest of the line is empty; and the
//      same with a line inside a region.
//   3. Squeeze: a star (or an empty cell) here would leave some unit without room for its
//      stars.
//   3.5-4 Region Groups: 2, 3 or 4 regions that fit inside as many lines (or lines inside
//      regions) take all their stars.
//   5. Trial: assume a star (or an empty cell); if the steps above then hit a contradiction,
//      it is the other way round.

import { cellName, listJoin } from "../logic";
import type { CellValue, LiteStep } from "../logic";
import { around, buildStars, randomStarPuzzle, touching } from "./engine";
import type { StarPuzzle } from "./engine";

export interface StarState {
  /** Per cell: bit 0 = may be empty, bit 1 = may be a star. */
  dom: number[];
  placed: boolean[];
}

const EMPTY = 1;
const STAR = 2;

interface Unit {
  kind: "row" | "column" | "region";
  index: number;
  name: string;
  cells: number[];
}

const unitCache = new WeakMap<StarPuzzle, Unit[]>();
/** Rows, then columns, then regions. */
export function unitsOf(p: StarPuzzle): Unit[] {
  let u = unitCache.get(p);
  if (u) return u;
  const n = p.n;
  u = [
    ...Array.from({ length: n }, (_, r) => ({ kind: "row" as const, index: r, name: `row ${r + 1}`, cells: Array.from({ length: n }, (_, c) => r * n + c) })),
    ...Array.from({ length: n }, (_, c) => ({ kind: "column" as const, index: c, name: `column ${c + 1}`, cells: Array.from({ length: n }, (_, r) => r * n + c) })),
    ...p.regions.map((cells, g) => ({ kind: "region" as const, index: g, name: regionName(p, g), cells })),
  ];
  unitCache.set(p, u);
  return u;
}

/** "the region at r1c1" (named by its first cell). */
export const regionName = (p: StarPuzzle, g: number) => `the region at ${cellName(p.n, p.regions[g][0])}`;

export function startState(p: StarPuzzle): StarState {
  return { dom: new Array(p.n * p.n).fill(EMPTY | STAR), placed: new Array(p.n * p.n).fill(false) };
}

export function cloneStars(s: StarState): StarState {
  return { dom: s.dom.slice(), placed: s.placed.slice() };
}

/** Put a star (1) or an empty cell (0) in a cell. */
export function place(_p: StarPuzzle, s: StarState, cell: number, v: number): void {
  s.dom[cell] = v ? STAR : EMPTY;
  s.placed[cell] = true;
}

export function applyStep(p: StarPuzzle, s: StarState, step: LiteStep): void {
  for (const pl of step.placements) place(p, s, pl.cell, pl.value);
}

const isStar = (s: StarState, i: number) => s.dom[i] === STAR;
const isOpen = (s: StarState, i: number) => s.dom[i] === (EMPTY | STAR);
const starsIn = (s: StarState, cells: number[]) => cells.filter((i) => isStar(s, i)).length;
const openIn = (s: StarState, cells: number[]) => cells.filter((i) => isOpen(s, i));
const need = (p: StarPuzzle, s: StarState, u: Unit) => p.k - starsIn(s, u.cells);

/** At most how many stars fit among these cells without touching (only 0, 1, 2 or "more" matter). */
function room(n: number, cells: number[], want: number): number {
  if (want <= 1 || cells.length <= 1) return Math.min(cells.length, Math.max(want, 1));
  // Two cells that don't touch?
  for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) if (!touching(n, cells[a], cells[b])) return 2;
  return 1;
}

const names = (n: number, cells: number[]) => listJoin(cells.map((i) => cellName(n, i)));
const starWord = (k: number) => (k === 1 ? "star" : "stars");

function step(technique: string, level: number, weight: number, placements: CellValue[], region: number[], nudge: string, explanation: string): LiteStep {
  return { technique, level, weight, placements, eliminations: [], region, nudge, explanation };
}

/** Something impossible on the board (what a trial runs into), or null. */
export function why(p: StarPuzzle, s: StarState): { text: string; cells: number[] } | null {
  const n = p.n;
  for (let i = 0; i < n * n; i++) {
    if (!s.dom[i]) return { text: `${cellName(n, i)} could be neither a star nor empty`, cells: [i] };
    if (isStar(s, i)) for (const j of around(n, i)) if (j > i && isStar(s, j)) return { text: `the stars in ${cellName(n, i)} and ${cellName(n, j)} would touch`, cells: [i, j] };
  }
  for (const u of unitsOf(p)) {
    const got = starsIn(s, u.cells);
    if (got > p.k) return { text: `${u.name} would have ${got} stars`, cells: u.cells };
    const m = p.k - got;
    if (m > 0 && room(n, openIn(s, u.cells), m) < m)
      return { text: `${u.name} would have no room left for its ${m === 1 && p.k > 1 ? "second star" : starWord(m)}`, cells: u.cells };
  }
  return null;
}

type Finder = (p: StarPuzzle, s: StarState) => LiteStep | null;

/** Around a Star: the cells around a star are empty. */
const aroundStar: Finder = (p, s) => {
  const n = p.n;
  for (let i = 0; i < n * n; i++) {
    if (!isStar(s, i)) continue;
    const open = around(n, i).filter((j) => isOpen(s, j));
    if (!open.length) continue;
    return step(
      "Around a Star",
      1,
      0,
      open.map((cell) => ({ cell, value: 0 })),
      [i],
      `Look around the star in ${cellName(n, i)}.`,
      `${cellName(n, i)} holds a star, and stars never touch: ${open.length === 1 ? `${names(n, open)} is` : `the cells around it (${names(n, open)}) are`} empty.`,
    );
  }
  return null;
};

/** Full Unit: a unit with all its stars; the rest of it is empty. */
const fullUnit: Finder = (p, s) => {
  for (const u of unitsOf(p)) {
    if (need(p, s, u) !== 0) continue;
    const open = openIn(s, u.cells);
    if (!open.length) continue;
    const stars = u.cells.filter((i) => isStar(s, i));
    return step(
      "Full Unit",
      1,
      0,
      open.map((cell) => ({ cell, value: 0 })),
      u.cells,
      `${cap(u.name)} has ${p.k === 1 ? "its star" : "all its stars"}.`,
      `${cap(u.name)} has its ${p.k === 1 ? "star" : `${p.k} stars`} (${names(p.n, stars)}), so its other cells are empty: ${names(p.n, open)}.`,
    );
  }
  return null;
};

/** Last Cells: a unit with as many open cells as stars it still needs. */
const lastCells: Finder = (p, s) => {
  for (const u of unitsOf(p)) {
    const m = need(p, s, u);
    const open = openIn(s, u.cells);
    if (m <= 0 || open.length !== m) continue;
    return step(
      "Last Cells",
      1,
      0.5,
      open.map((cell) => ({ cell, value: 1 })),
      u.cells,
      `${cap(u.name)} has just enough room left for its ${starWord(m)}.`,
      `${cap(u.name)} still needs ${m === 1 ? "a star" : `${m} stars`}, and only ${names(p.n, open)} ${open.length === 1 ? "is" : "are"} left: ${open.length === 1 ? "a star goes there" : "stars go there"}.`,
    );
  }
  return null;
};

/** Shared Neighbour: a cell (outside the unit) touching every open cell of a unit that needs one more star. */
const sharedNeighbour: Finder = (p, s) => {
  const n = p.n;
  for (const u of unitsOf(p)) {
    if (need(p, s, u) !== 1) continue;
    const open = openIn(s, u.cells);
    if (open.length < 2 || open.length > 6) continue;
    const hit: number[] = [];
    for (let i = 0; i < n * n; i++) if (isOpen(s, i) && !open.includes(i) && open.every((j) => touching(n, i, j))) hit.push(i);
    if (!hit.length) continue;
    return step(
      "Shared Neighbour",
      2,
      1,
      hit.map((cell) => ({ cell, value: 0 })),
      open,
      `The ${p.k > 1 ? "last star" : "star"} of ${u.name} has only a few places left. What do they all touch?`,
      `The ${p.k > 1 ? "last star" : "star"} of ${u.name} goes in ${listJoin(open.map((i) => cellName(n, i))).replace(/ and /, " or ")}. ${names(n, hit)} ${hit.length === 1 ? "touches" : "touch"} ${open.length === 2 ? "both" : "all of them"}, so whichever it is, ${hit.length === 1 ? "that cell" : "those cells"} would touch the star: empty.`,
    );
  }
  return null;
};

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
/** "rows 3 and 4", "the regions at r1c1 and r2c5", or one unit's name. */
function unitList(p: StarPuzzle, us: Unit[]): string {
  if (us.length === 1) return us[0].name;
  const kind = us[0].kind;
  if (kind === "region") return `the regions at ${listJoin(us.map((u) => cellName(p.n, u.cells[0])))}`;
  return `${kind}s ${listJoin(us.map((u) => String(u.index + 1)))}`;
}
const linesOfKind = (p: StarPuzzle, kind: "row" | "column") => unitsOf(p).filter((u) => u.kind === kind);
const regionsOf = (p: StarPuzzle) => unitsOf(p).filter((u) => u.kind === "region");
const rowOf = (n: number, i: number) => Math.floor(i / n);
const colOf = (n: number, i: number) => i % n;

/**
 * Groups: `size` regions whose open cells all lie in `size` rows (or columns) that need as
 * many stars take all of those lines' stars: the rest of the lines is empty. And the other
 * way: `size` lines whose open cells all lie in `size` regions; the rest of those regions is
 * empty. Size 1 is Confined Unit (level 2); 2 to 4 are Region Groups.
 */
const groups =
  (size: number): Finder =>
  (p, s) => {
    const n = p.n;
    const level = size === 1 ? 2 : size === 2 ? 3.5 : 4;
    const weight = size === 1 ? 1.5 : size === 2 ? 5 : size === 3 ? 7 : 9;
    const technique = size === 1 ? "Confined Unit" : "Region Groups";
    const info = (u: Unit) => ({ u, open: openIn(s, u.cells), need: need(p, s, u) });
    const regs = regionsOf(p).map(info).filter((x) => x.need > 0);
    for (const kind of ["row", "column"] as const) {
      const lines = linesOfKind(p, kind).map(info).filter((x) => x.need > 0);
      const lineIndex = (i: number) => (kind === "row" ? rowOf(n, i) : colOf(n, i));
      // Regions inside lines, then lines inside regions. Each unit: a mask of the outer units its open cells are in.
      for (const [inner, outerOf, outerAll] of [
        [regs, (i: number) => lineIndex(i), lines],
        [lines, (i: number) => p.regionOf[i], regs],
      ] as const) {
        const masks = inner.map((x) => x.open.reduce((m, i) => m | (1 << outerOf(i)), 0));
        const byIndex = new Map(outerAll.map((x) => [x.u.index, x]));
        const found = combos(inner.length, size, (pick) => {
          const mask = pick.reduce((m, k) => m | masks[k], 0);
          let bits = 0;
          for (let m = mask; m; m &= m - 1) bits++;
          if (bits !== size) return null;
          const outer = [];
          for (let x = 0; x < n; x++) if (mask & (1 << x)) outer.push(byIndex.get(x));
          if (outer.some((o) => !o)) return null;
          const out = outer as NonNullable<(typeof outer)[number]>[];
          const us = pick.map((k) => inner[k]);
          const needIn = us.reduce((a, x) => a + x.need, 0);
          if (needIn !== out.reduce((a, x) => a + x.need, 0)) return null;
          const inside = new Set(us.flatMap((x) => x.u.cells));
          const hit = out.flatMap((x) => x.open).filter((i) => !inside.has(i));
          if (!hit.length) return null;
          return { us: us.map((x) => x.u), outer: out.map((x) => x.u), hit: hit.sort((a, b) => a - b), needIn, open: us.flatMap((x) => x.open) };
        });
        if (!found) continue;
        const { us, outer, hit, needIn, open } = found;
        const what = (list: Unit[]) => unitList(p, list);
        const count = (m: number) => (m === 1 ? "one star" : `${m} stars`);
        const one = size === 1;
        const explanation = one
          ? `${cap(us[0].name)} can only put ${needIn === 1 ? "its star" : `its ${needIn} stars`} in ${outer[0].name}, which needs exactly ${count(needIn)}. So ${outer[0].kind === "region" ? "that region" : outer[0].name} gets ${needIn === 1 ? "its star" : "its stars"} from ${us[0].kind === "region" ? "that region" : us[0].name}, and the rest of it is empty: ${names(n, hit)}.`
          : `${cap(what(us))} can only put their ${count(needIn)} in ${what(outer)}, which need exactly ${count(needIn)} between them. So all the stars of ${what(outer)} come from ${us[0].kind === "region" ? "these regions" : `these ${kind}s`}, and ${names(n, hit)} ${hit.length === 1 ? "is" : "are"} empty.`;
        const innerIsRegion = us[0].kind === "region";
        return step(
          technique,
          level,
          weight,
          hit.map((cell) => ({ cell, value: 0 })),
          [...new Set(open)],
          one ? `${cap(us[0].name)} has all its open cells in one ${innerIsRegion ? kind : "region"}.` : `Look for ${size} ${innerIsRegion ? "regions" : `${kind}s`} that fit inside ${size} ${innerIsRegion ? `${kind}s` : "regions"}.`,
          explanation,
        );
      }
    }
    return null;
  };

/**
 * Pair Blocks (two stars): two neighbouring rows (or columns) cut into 2×2 blocks (and a
 * 2×1 piece at an edge). Each piece holds at most one star; when exactly as many pieces
 * have open cells as the two lines still need stars, each of them holds one, and every
 * open cell that touches all open cells of such a piece is empty.
 */
const pairBlocks: Finder = (p, s) => {
  const n = p.n;
  if (p.k < 2) return null;
  const lines = unitsOf(p);
  for (const kind of ["row", "column"] as const) {
    for (let a = 0; a < n - 1; a++) {
      const A = lines.find((u) => u.kind === kind && u.index === a)!;
      const B = lines.find((u) => u.kind === kind && u.index === a + 1)!;
      const needAB = need(p, s, A) + need(p, s, B);
      if (needAB <= 0) continue;
      const at = (line: number, pos: number) => (kind === "row" ? line * n + pos : pos * n + line);
      for (const offset of [0, 1]) {
        // Pieces along the pair: positions [offset-1, offset], [offset+1, offset+2], …
        const pieces: number[][] = [];
        for (let x = offset - 2; x < n; x += 2) {
          const cols = [x, x + 1].filter((c) => c >= 0 && c < n);
          if (!cols.length) continue;
          const cells = cols.flatMap((c) => [at(a, c), at(a + 1, c)]).filter((i) => isOpen(s, i));
          if (cells.length) pieces.push(cells);
        }
        if (pieces.length !== needAB) continue;
        const hit: number[] = [];
        let from: number[] = [];
        for (const piece of pieces) {
          const add = [];
          for (let i = 0; i < n * n; i++) if (isOpen(s, i) && !piece.includes(i) && !hit.includes(i) && piece.every((j) => touching(n, i, j))) add.push(i);
          if (add.length) {
            hit.push(...add);
            from = from.concat(piece);
          }
        }
        if (!hit.length) continue;
        hit.sort((x, y) => x - y);
        const both = `${kind}s ${a + 1} and ${a + 2}`;
        return step(
          "Pair Blocks",
          3.5,
          5,
          hit.map((cell) => ({ cell, value: 0 })),
          pieces.flat(),
          `Cut ${both} into 2×2 blocks and count.`,
          `${cap(both)} still need ${needAB} stars between them. Cut into 2×2 blocks (one star at most in each), only ${needAB} blocks still have open cells, so each of them holds exactly one star. ${names(n, hit)} ${hit.length === 1 ? "touches" : "touch"} all the open cells of one of those blocks (${names(n, from)}), so ${hit.length === 1 ? "it is" : "they are"} empty.`,
        );
      }
    }
  }
  return null;
};

/** Run `fn` on every k-subset of 0..m-1 until it returns something. */
function combos<T>(m: number, k: number, fn: (pick: number[]) => T | null): T | null {
  const pick: number[] = [];
  const go = (from: number): T | null => {
    if (pick.length === k) return fn(pick);
    for (let x = from; x <= m - (k - pick.length); x++) {
      pick.push(x);
      const r = go(x + 1);
      pick.pop();
      if (r) return r;
    }
    return null;
  };
  return go(0);
}

/**
 * Squeeze: a star in this cell would empty the cells around it, leaving some unit without
 * room for its stars; so the cell is empty. (And: an empty cell here would leave a unit
 * without room; so it is a star.) Checked per unit, without trying the whole board.
 */
const squeeze: Finder = (p, s) => {
  const n = p.n;
  const level = p.k > 1 ? 2 : 3;
  for (const u of unitsOf(p)) {
    const m = need(p, s, u);
    const open = openIn(s, u.cells);
    if (m <= 0 || open.length > 12) continue;
    const near = new Set<number>();
    for (const c of open) {
      near.add(c);
      for (const j of around(n, c)) if (isOpen(s, j)) near.add(j);
    }
    for (const i of [...near].sort((a, b) => a - b)) {
      for (const v of [1, 0]) {
        if (!v && !open.includes(i)) continue;
        const inside = u.cells.includes(i);
        const left = v ? open.filter((c) => c !== i && !touching(n, c, i)) : open.filter((c) => c !== i);
        const m2 = v && inside ? m - 1 : m;
        if (m2 <= 0 || room(n, left, m2) >= m2) continue;
        // Plain cases come earlier: Last Cells (an empty cell) and Shared Neighbour.
        if (!v && open.length === m) continue;
        const second = m2 === 1 && p.k > 1 && (starsIn(s, u.cells) > 0 || inside);
        const lacks = left.length
          ? `only ${names(n, left)} would be left for its ${second ? "second star" : starWord(m2)}${m2 > 1 ? `, and ${left.length === 1 ? "that is one cell" : "those all touch"}` : ""}`
          : `nothing would be left for its ${second ? "second star" : starWord(m2)}`;
        return step(
          "Squeeze",
          level,
          p.k > 1 ? 1.5 : 3,
          [{ cell: i, value: v ? 0 : 1 }],
          [i, ...open],
          `What would a ${v ? "star" : "gap"} in ${cellName(n, i)} do to ${u.name}?`,
          v
            ? `If ${cellName(n, i)} held a star, ${inside ? `${u.name} would still need ${count1(m2)}, ` : ""}the cells around it would be empty, and in ${u.name} ${lacks}. So ${cellName(n, i)} is empty.`
            : `If ${cellName(n, i)} were empty, in ${u.name} ${lacks}. So ${cellName(n, i)} holds a star.`,
        );
      }
    }
  }
  return null;
};
const count1 = (m: number) => (m === 1 ? "one more star" : `${m} more stars`);

/** The 2×2 block with top-left cell (r, c), as cells. */
const block = (n: number, r: number, c: number) => [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
/** True when all the cells fit in one 2×2 block (so at most one of them holds a star). */
const inOneBlock = (n: number, cells: number[]) => {
  const rs = cells.map((i) => rowOf(n, i));
  const cs = cells.map((i) => colOf(n, i));
  return Math.max(...rs) - Math.min(...rs) <= 1 && Math.max(...cs) - Math.min(...cs) <= 1;
};

/**
 * Blocks (two stars): a unit that needs 2 stars, whose open cells fit in two 2×2 blocks.
 * A block holds at most one star, so each holds exactly one; every open cell touching all
 * of a block's cells is empty.
 */
const blocks: Finder = (p, s) => {
  const n = p.n;
  if (p.k < 2) return null;
  for (const u of unitsOf(p)) {
    if (need(p, s, u) !== 2) continue;
    const open = openIn(s, u.cells);
    if (open.length < 3 || open.length > 8) continue;
    const first = open[0];
    const r0 = rowOf(n, first);
    const c0 = colOf(n, first);
    for (let dr = -1; dr <= 0; dr++)
      for (let dc = -1; dc <= 0; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= n - 1 || c >= n - 1) continue;
        const box = new Set(block(n, r, c));
        const a = open.filter((i) => box.has(i));
        const b = open.filter((i) => !box.has(i));
        if (!b.length || !inOneBlock(n, b)) continue;
        const hit: number[] = [];
        for (const grp of [a, b])
          for (let i = 0; i < n * n; i++) if (isOpen(s, i) && !grp.includes(i) && !hit.includes(i) && grp.every((j) => touching(n, i, j))) hit.push(i);
        if (!hit.length) continue;
        hit.sort((x, y) => x - y);
        return step(
          "Blocks",
          2.5,
          2.5,
          hit.map((cell) => ({ cell, value: 0 })),
          open,
          `${cap(u.name)} needs 2 stars, and its open cells fit in two small blocks.`,
          `${cap(u.name)} still needs 2 stars, and its open cells fit in two 2×2 blocks: one with ${names(n, a)}, the other with ${names(n, b)}. A 2×2 block holds at most one star, so each of these holds exactly one. ${names(n, hit)} ${hit.length === 1 ? "touches" : "touch"} all the open cells of one of the blocks, so a star there would leave that block without one: ${hit.length === 1 ? "it is" : "they are"} empty.`,
        );
      }
  }
  return null;
};

const FINDERS_1: Finder[] = [aroundStar, fullUnit, lastCells, sharedNeighbour, groups(1), squeeze, groups(2), groups(3), groups(4)];
const FINDERS_2: Finder[] = [aroundStar, fullUnit, lastCells, sharedNeighbour, groups(1), blocks, squeeze, pairBlocks, groups(2), groups(3), groups(4)];

function easiest(p: StarPuzzle, s: StarState, chains = true): LiteStep | "contradiction" | null {
  if (why(p, s)) return "contradiction";
  for (const f of p.k > 1 ? FINDERS_2 : FINDERS_1) {
    const st = f(p, s);
    if (st) return st;
  }
  return chains ? shortChain(p, s) : null;
}

const SIMPLE: Finder[] = [aroundStar, fullUnit, lastCells];

/**
 * Short Chain: assume a star (or an empty cell) and follow only the simplest steps (around a
 * star, full units, last cells), a few at most; if that already breaks something, it is
 * the other way round. What a person checks in their head before trying anything longer.
 */
function shortChain(p: StarPuzzle, s: StarState): LiteStep | null {
  const n = p.n;
  let best: { i: number; v: number; steps: LiteStep[]; reason: { text: string; cells: number[] } } | null = null;
  for (let i = 0; i < n * n; i++) {
    if (!isOpen(s, i)) continue;
    for (const v of [1, 0]) {
      const t = cloneStars(s);
      place(p, t, i, v);
      const steps: LiteStep[] = [];
      let reason = why(p, t);
      for (let k = 0; k < 6 && !reason; k++) {
        const st = SIMPLE.map((f) => f(p, t)).find(Boolean);
        if (!st) break;
        steps.push(st);
        applyStep(p, t, st);
        reason = why(p, t);
      }
      if (reason && (!best || steps.length < best.steps.length)) best = { i, v, steps, reason };
      if (best && best.steps.length <= 1) break;
    }
    if (best && best.steps.length <= 1) break;
  }
  if (!best) return null;
  const { i, v, steps, reason } = best;
  const name = cellName(n, i);
  const chain = chainOf(p, steps, reason);
  const said = chain.length ? `Then ${chain.join("; ")}; and then ${reason.text}.` : `Then at once ${reason.text}.`;
  return {
    technique: "Short Chain",
    level: 4,
    weight: 4 + 2 * steps.length,
    placements: [{ cell: i, value: v ? 0 : 1 }],
    eliminations: [],
    region: [i, ...reason.cells],
    nudge: `What would ${v ? "a star" : "an empty cell"} in ${name} lead to?`,
    explanation: `Suppose ${name} ${v ? "held a star" : "were empty"}. ${said} That can't be, so ${name} ${v ? "is empty" : "holds a star"}.`,
  };
}

const solved = (s: StarState) => s.placed.every(Boolean);

/**
 * The steps from an assumption to a contradiction, latest first while they matter: a
 * placement matters when it is in a cell the chain relies on, or touches one, or shares a
 * row, column or region with one.
 */
function chainOf(p: StarPuzzle, steps: LiteStep[], end: { text: string; cells: number[] }, max = 8): string[] {
  const n = p.n;
  const premise = new Set(end.cells);
  const out: string[] = [];
  const related = (a: number, b: number) => a === b || touching(n, a, b) || rowOf(n, a) === rowOf(n, b) || colOf(n, a) === colOf(n, b) || p.regionOf[a] === p.regionOf[b];
  for (let k = steps.length - 1; k >= 0; k--) {
    const st = steps[k];
    const used = st.placements.filter((pl) => [...premise].some((c) => related(c, pl.cell)));
    if (!used.length) continue;
    const stars = used.filter((pl) => pl.value);
    const gaps = used.filter((pl) => !pl.value);
    const parts: string[] = [];
    if (stars.length) parts.push(`${names(n, stars.map((x) => x.cell))} would ${stars.length === 1 ? "hold a star" : "hold stars"}`);
    if (gaps.length) parts.push(`${names(n, gaps.map((x) => x.cell))} would be empty`);
    out.unshift(`${parts.join(" and ")} (${st.technique.toLowerCase()})`);
    st.region.forEach((c) => premise.add(c));
    st.placements.forEach((pl) => premise.add(pl.cell));
  }
  return out.length > max ? ["…", ...out.slice(-max)] : out;
}

/**
 * Trial: assume a star (or an empty cell) and follow the easier steps; if that hits a
 * contradiction, the cell is the other way round. Of the first few that break, the one
 * with the shortest chain is shown.
 */
const trial = (p: StarPuzzle, s: StarState): LiteStep | null => {
  const n = p.n;
  // Cells of the units with the fewest open cells first: those are the easiest to try.
  const units = unitsOf(p)
    .filter((u) => need(p, s, u) > 0)
    .sort((a, b) => openIn(s, a.cells).length - openIn(s, b.cells).length);
  const cells = [...new Set(units.flatMap((u) => openIn(s, u.cells)))];
  let best: { i: number; v: number; chain: string[]; reason: { text: string; cells: number[] } } | null = null;
  let found = 0;
  search: for (const i of cells)
    for (const v of [1, 0]) {
      const t = cloneStars(s);
      place(p, t, i, v);
      const steps: LiteStep[] = [];
      let broken = false;
      for (let k = 0; k < 400 && !solved(t); k++) {
        const st = easiest(p, t, false);
        if (st === "contradiction") {
          broken = true;
          break;
        }
        if (!st) break;
        steps.push(st);
        applyStep(p, t, st);
      }
      if (!broken) continue;
      const reason = why(p, t) ?? { text: "the puzzle would break", cells: [] };
      const chain = chainOf(p, steps, reason);
      if (!best || chain.length < best.chain.length) best = { i, v, chain, reason };
      if (++found >= 4 || chain.length <= 2) break search;
    }
  if (!best) return null;
  const { i, v, chain, reason } = best;
  const name = cellName(n, i);
  const what = v ? "held a star" : "were empty";
  const said = chain.length ? `Then ${chain.join("; ")}; and then ${reason.text}.` : `Then at once ${reason.text}.`;
  return {
    technique: "Trial",
    level: 5,
    weight: 20,
    placements: [{ cell: i, value: v ? 0 : 1 }],
    eliminations: [],
    region: [i, ...reason.cells],
    nudge: `Try ${v ? "a star" : "an empty cell"} in ${name} and follow where it leads.`,
    explanation: `Suppose ${name} ${what}. ${said} That can't be, so ${name} ${v ? "is empty" : "holds a star"}.`,
  };
};

export function nextStep(p: StarPuzzle, s: StarState): LiteStep | null {
  const r = easiest(p, s);
  if (r === "contradiction") return null;
  return r ?? trial(p, s);
}

/** Solve step by step; at most `maxTrials` trial steps. */
export function logicSolveStars(p: StarPuzzle, from: StarState = startState(p), maxTrials = 3): { steps: LiteStep[]; solved: boolean } {
  const s = cloneStars(from);
  const steps: LiteStep[] = [];
  let trials = 0;
  for (let k = 0; k < 1000 && !solved(s); k++) {
    const e = easiest(p, s);
    let st = e === "contradiction" ? null : e;
    if (!st && e !== "contradiction" && trials < maxTrials) {
      st = trial(p, s);
      trials++;
    }
    if (!st) break;
    steps.push(st);
    applyStep(p, s, st);
  }
  return { steps, solved: solved(s) };
}

export const STAR_LEVELS = ["Easy", "Medium", "Hard", "Expert"] as const;
export type StarLevel = (typeof STAR_LEVELS)[number];

/** Step totals per size: Medium above [0], Hard above [1], Expert above [2] (from the spread of random puzzles). */
export const STAR_CUTS: Record<number, [number, number, number]> = { 6: [8, 16, 30], 8: [10, 20, 40], 10: [45, 60, 85] };

/**
 * Rating, or null when it needs more than 3 trial steps. By the step total, within bounds
 * set by the hardest step: only the basic steps (and Squeeze, Blocks) make Easy or Medium;
 * Region Groups and Pair Blocks at least Medium; Short Chain at least Hard; Trial Expert.
 * With `plainOnly`, puzzles that need trial give null (quicker, for the easier levels).
 */
export function rateStars(p: StarPuzzle, plainOnly = false): { score: number; maxLevel: number; level: StarLevel } | null {
  const plain = logicSolveStars(p, startState(p), 0);
  const score = plain.steps.reduce((a, st) => a + st.weight, 0);
  const maxLevel = plain.steps.reduce((a, st) => Math.max(a, st.level), 0);
  if (plain.solved) {
    const cuts = STAR_CUTS[p.n] ?? STAR_CUTS[8];
    let k = cuts.filter((c) => score > c).length;
    if (maxLevel >= 4) k = Math.max(k, 2);
    else if (maxLevel >= 3.5) k = Math.min(Math.max(k, 1), 2);
    else k = Math.min(k, 1);
    return { score, maxLevel, level: STAR_LEVELS[k] };
  }
  if (plainOnly) return null;
  const t = logicSolveStars(p, startState(p), 3);
  return t.solved ? { score: t.steps.reduce((a, st) => a + st.weight, 0), maxLevel: 5, level: "Expert" } : null;
}

const p2skew = (n: number) => (n >= 9 ? 4 : 0);

/** Make a puzzle of a size and level (the closest found within the time budget). */
export function* makeStars(n: number, level: StarLevel, rnd: () => number, budgetMs = 5000): Generator<number, StarPuzzle> {
  const t0 = performance.now();
  const want = STAR_LEVELS.indexOf(level);
  let best: { p: StarPuzzle; miss: number } | null = null;
  for (let tries = 1; ; tries++) {
    // Two-star boards: let some regions stay small (more puzzles that need no trial).
    const p = randomStarPuzzle(n, rnd, p2skew(n));
    if (p) {
      const r = rateStars(p, level !== "Expert");
      if (r) {
        const miss = Math.abs(STAR_LEVELS.indexOf(r.level) - want);
        if (!miss) return p;
        if (!best || miss < best.miss) best = { p, miss };
      }
    }
    if (best && performance.now() - t0 > budgetMs) return best.p;
    yield tries;
  }
}

export { buildStars };
