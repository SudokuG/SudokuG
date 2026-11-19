// Star Battle steps, from Around a Star to Region Groups (see logic.ts for the list and
// levels). Each finder returns the easiest step of its kind, or null.

import { cellName, listJoin } from "../logic";
import type { LiteStep } from "../logic";
import { around, touching } from "./engine";
import type { StarPuzzle } from "./engine";
import { isOpen, isStar, names, need, openIn, room, starWord, starsIn, step, unitsOf } from "./state";
import type { StarState, Unit } from "./state";

export type Finder = (p: StarPuzzle, s: StarState) => LiteStep | null;

/** Around a Star: the cells around a star are empty. */
export const aroundStar: Finder = (p, s) => {
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
export const fullUnit: Finder = (p, s) => {
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
export const lastCells: Finder = (p, s) => {
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
export const sharedNeighbour: Finder = (p, s) => {
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

export const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
/** "rows 3 and 4", "the regions at r1c1 and r2c5", or one unit's name. */
export function unitList(p: StarPuzzle, us: Unit[]): string {
  if (us.length === 1) return us[0].name;
  const kind = us[0].kind;
  if (kind === "region") return `the regions at ${listJoin(us.map((u) => cellName(p.n, u.cells[0])))}`;
  return `${kind}s ${listJoin(us.map((u) => String(u.index + 1)))}`;
}
export const linesOfKind = (p: StarPuzzle, kind: "row" | "column") => unitsOf(p).filter((u) => u.kind === kind);
export const regionsOf = (p: StarPuzzle) => unitsOf(p).filter((u) => u.kind === "region");
export const rowOf = (n: number, i: number) => Math.floor(i / n);
export const colOf = (n: number, i: number) => i % n;

/**
 * Groups: `size` regions whose open cells all lie in `size` rows (or columns) that need as
 * many stars take all of those lines' stars: the rest of the lines is empty. And the other
 * way: `size` lines whose open cells all lie in `size` regions; the rest of those regions is
 * empty. Size 1 is Confined Unit (level 2); 2 to 4 are Region Groups.
 */
export const groups =
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
export const pairBlocks: Finder = (p, s) => {
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
export function combos<T>(m: number, k: number, fn: (pick: number[]) => T | null): T | null {
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
export const squeeze: Finder = (p, s) => {
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
export const count1 = (m: number) => (m === 1 ? "one more star" : `${m} more stars`);

/** The 2×2 block with top-left cell (r, c), as cells. */
export const block = (n: number, r: number, c: number) => [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
/** True when all the cells fit in one 2×2 block (so at most one of them holds a star). */
export const inOneBlock = (n: number, cells: number[]) => {
  const rs = cells.map((i) => rowOf(n, i));
  const cs = cells.map((i) => colOf(n, i));
  return Math.max(...rs) - Math.min(...rs) <= 1 && Math.max(...cs) - Math.min(...cs) <= 1;
};

/**
 * Blocks (two stars): a unit that needs 2 stars, whose open cells fit in two 2×2 blocks.
 * A block holds at most one star, so each holds exactly one; every open cell touching all
 * of a block's cells is empty.
 */
export const blocks: Finder = (p, s) => {
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

export const FINDERS_1: Finder[] = [aroundStar, fullUnit, lastCells, sharedNeighbour, groups(1), squeeze, groups(2), groups(3), groups(4)];
export const FINDERS_2: Finder[] = [aroundStar, fullUnit, lastCells, sharedNeighbour, groups(1), blocks, squeeze, pairBlocks, groups(2), groups(3), groups(4)];
