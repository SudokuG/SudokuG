// Basic fish: X-Wing (2), Swordfish (3), Jellyfish (4).
//
// Take n "base" rows in which digit d has at most n possible cells, all lying in the
// same n columns (the "cover" columns). The n d's of those rows must sit in those
// columns, one per column, so no other cell of the cover columns can hold d.
// The same works with rows and columns swapped.

import { COLS, ROWS, cellList, colOf, listJoin, rowOf } from "./grid";
import type { CellDigit, Technique } from "./types";
import { combinations, placedInUnit, positions, unitIdx } from "./util";

const FISH_NAME = ["", "", "X-Wing", "Swordfish", "Jellyfish"];

export function fish(n: number, level: number): Technique {
  const name = FISH_NAME[n];
  return {
    name,
    level,
    find(g) {
      for (let d = 1; d <= 9; d++) {
        for (const byRow of [true, false]) {
          const bases = byRow ? ROWS : COLS;
          const covers = byRow ? COLS : ROWS;
          const crossKey = byRow ? colOf : rowOf;
          const lines = bases
            .filter((u) => !placedInUnit(g, u, d))
            .map((u) => ({ u, pos: positions(g, u, d) }))
            .filter((x) => x.pos.length >= 2 && x.pos.length <= n);
          if (lines.length < n) continue;
          for (const combo of combinations(lines, n)) {
            const coverIdx = new Set<number>();
            for (const l of combo) for (const c of l.pos) coverIdx.add(crossKey(c));
            if (coverIdx.size !== n) continue;
            const baseCells = new Set(combo.flatMap((l) => l.pos));
            const coverUnits = [...coverIdx].sort((a, b) => a - b).map((i) => covers[i]);
            const eliminations: CellDigit[] = [];
            for (const cu of coverUnits)
              for (const c of positions(g, cu, d)) if (!baseCells.has(c)) eliminations.push({ cell: c, digit: d });
            if (!eliminations.length) continue;
            const baseKind = byRow ? "rows" : "columns";
            const coverKind = byRow ? "columns" : "rows";
            const baseNums = combo.map((l) => l.u.index + 1);
            const coverNums = coverUnits.map((u) => u.index + 1);
            const cells = [...baseCells].sort((a, b) => a - b);
            return {
              technique: name,
              level,
              placements: [],
              eliminations,
              cells,
              candidates: cells.map((cell) => ({ cell, digit: d })),
              units: [...combo.map((l) => unitIdx(l.u)), ...coverUnits.map(unitIdx)],
              nudge: `Look at where ${d} can go in the ${baseKind}.`,
              explanation:
                `In ${baseKind} ${listJoin(baseNums)}, the digit ${d} can only go in ${coverKind} ${listJoin(coverNums)}. ` +
                `Each of these ${n} ${baseKind} needs a ${d}, and they must use ${n} different ${coverKind}, so the ${d}s of ` +
                `${coverKind} ${listJoin(coverNums)} are all taken by these ${baseKind}. ` +
                `${d} can be removed from the other cells of those ${coverKind}: ${cellList(eliminations.map((e) => e.cell))}.`,
            };
          }
        }
      }
      return null;
    },
  };
}
