// Basic techniques: singles, locked candidates, naked and hidden subsets.

import { BOXES, UNITS, bit, boxOf, cellList, cellName, colOf, digitsOf, listJoin, popcount, rowOf, unitName } from "./grid";
import type { CellDigit, Technique } from "./types";
import { SCAN_ORDER, cap, combinations, placedInUnit, positions, unitIdx } from "./util";

const SIZE_NAME = ["", "Single", "Pair", "Triple", "Quad"];

// ---------------------------------------------------------------------------
// Singles

export const fullHouse: Technique = {
  name: "Full House",
  level: 1,
  find(g) {
    for (const u of SCAN_ORDER) {
      const empty = u.cells.filter((c) => !g.values[c]);
      if (empty.length !== 1) continue;
      const cell = empty[0];
      const missing = digitsOf(0x1ff & ~u.cells.reduce((m, c) => (g.values[c] ? m | bit(g.values[c]) : m), 0));
      if (missing.length !== 1) continue;
      const d = missing[0];
      return {
        technique: "Full House",
        level: 1,
        placements: [{ cell, digit: d }],
        eliminations: [],
        cells: [cell],
        candidates: [{ cell, digit: d }],
        units: [unitIdx(u)],
        nudge: `Look at ${unitName(u)}: only one cell is left.`,
        explanation: `${cap(unitName(u))} has only one empty cell left, ${cellName(cell)}. The only digit missing from that ${u.kind} is ${d}.`,
      };
    }
    return null;
  },
};

export const hiddenSingle: Technique = {
  name: "Hidden Single",
  level: 1,
  find(g) {
    for (const u of SCAN_ORDER) {
      for (let d = 1; d <= 9; d++) {
        if (placedInUnit(g, u, d)) continue;
        const pos = positions(g, u, d);
        if (pos.length !== 1) continue;
        const cell = pos[0];
        return {
          technique: "Hidden Single",
          level: 1,
          placements: [{ cell, digit: d }],
          eliminations: [],
          cells: [cell],
          candidates: [{ cell, digit: d }],
          units: [unitIdx(u)],
          nudge: `Look for a ${d} in ${unitName(u)}.`,
          explanation: `In ${unitName(u)}, the digit ${d} can only go in ${cellName(cell)}. Every other cell in that ${u.kind} is filled or already sees a ${d}.`,
        };
      }
    }
    return null;
  },
};

export const nakedSingle: Technique = {
  name: "Naked Single",
  level: 1,
  find(g) {
    for (let cell = 0; cell < 81; cell++) {
      if (g.values[cell] || popcount(g.cands[cell]) !== 1) continue;
      const d = digitsOf(g.cands[cell])[0];
      return {
        technique: "Naked Single",
        level: 1,
        placements: [{ cell, digit: d }],
        eliminations: [],
        cells: [cell],
        candidates: [{ cell, digit: d }],
        units: [],
        nudge: `One cell has only a single candidate left. Look around ${blockHint(cell)}.`,
        explanation: `${cellName(cell)} has only one candidate left: ${d}. All other digits are excluded by its row, column or box.`,
      };
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Locked candidates

export const pointing: Technique = {
  name: "Locked Candidates (Pointing)",
  level: 2,
  find(g) {
    for (const box of BOXES) {
      for (let d = 1; d <= 9; d++) {
        const pos = positions(g, box, d);
        if (pos.length < 2) continue;
        for (const lineKind of ["row", "column"] as const) {
          const key = lineKind === "row" ? rowOf : colOf;
          if (!pos.every((c) => key(c) === key(pos[0]))) continue;
          const line = UNITS[(lineKind === "row" ? 0 : 9) + key(pos[0])];
          const elim = positions(g, line, d).filter((c) => boxOf(c) !== box.index);
          if (!elim.length) continue;
          return {
            technique: "Locked Candidates (Pointing)",
            level: 2,
            placements: [],
            eliminations: elim.map((cell) => ({ cell, digit: d })),
            cells: pos,
            candidates: pos.map((cell) => ({ cell, digit: d })),
            units: [unitIdx(box), unitIdx(line)],
            nudge: `Look at where ${d} can go in ${unitName(box)}.`,
            explanation: `In ${unitName(box)}, the ${d} must go in ${cellList(pos)}, which all lie in ${unitName(line)}. So the ${d} of ${unitName(line)} is inside this box, and ${d} can be removed from the rest of ${unitName(line)}: ${cellList(elim)}.`,
          };
        }
      }
    }
    return null;
  },
};

export const claiming: Technique = {
  name: "Locked Candidates (Claiming)",
  level: 2,
  find(g) {
    for (const line of UNITS.slice(0, 18)) {
      for (let d = 1; d <= 9; d++) {
        const pos = positions(g, line, d);
        if (pos.length < 2) continue;
        if (!pos.every((c) => boxOf(c) === boxOf(pos[0]))) continue;
        const box = BOXES[boxOf(pos[0])];
        const elim = positions(g, box, d).filter((c) => !line.cells.includes(c));
        if (!elim.length) continue;
        return {
          technique: "Locked Candidates (Claiming)",
          level: 2,
          placements: [],
          eliminations: elim.map((cell) => ({ cell, digit: d })),
          cells: pos,
          candidates: pos.map((cell) => ({ cell, digit: d })),
          units: [unitIdx(line), unitIdx(box)],
          nudge: `Look at where ${d} can go in ${unitName(line)}.`,
          explanation: `In ${unitName(line)}, the ${d} must go in ${cellList(pos)}, which all lie in ${unitName(box)}. So the ${d} of ${unitName(box)} is on this ${line.kind}, and ${d} can be removed from the other cells of the box: ${cellList(elim)}.`,
        };
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Naked and hidden subsets (pairs, triples, quads)

export function nakedSubset(n: number, level: number): Technique {
  const name = `Naked ${SIZE_NAME[n]}`;
  return {
    name,
    level,
    find(g) {
      for (const u of SCAN_ORDER) {
        const empty = u.cells.filter((c) => !g.values[c]);
        const pool = empty.filter((c) => {
          const k = popcount(g.cands[c]);
          return k >= 2 && k <= n;
        });
        if (pool.length < n || empty.length <= n) continue;
        for (const combo of combinations(pool, n)) {
          const union = combo.reduce((m, c) => m | g.cands[c], 0);
          if (popcount(union) !== n) continue;
          const others = empty.filter((c) => !combo.includes(c));
          const eliminations: CellDigit[] = [];
          for (const c of others) for (const d of digitsOf(g.cands[c] & union)) eliminations.push({ cell: c, digit: d });
          if (!eliminations.length) continue;
          const ds = digitsOf(union);
          return {
            technique: name,
            level,
            placements: [],
            eliminations,
            cells: combo,
            candidates: combo.flatMap((cell) => digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))),
            units: [unitIdx(u)],
            nudge: `There is a ${name.toLowerCase()} in ${unitName(u)}.`,
            explanation: `In ${unitName(u)}, the ${n} cells ${cellList(combo)} together contain only the candidates ${listJoin(ds)}. Those ${n} digits must fill those ${n} cells, so they can be removed from the other cells of the ${u.kind}.`,
          };
        }
      }
      return null;
    },
  };
}

export function hiddenSubset(n: number, level: number): Technique {
  const name = `Hidden ${SIZE_NAME[n]}`;
  return {
    name,
    level,
    find(g) {
      for (const u of SCAN_ORDER) {
        const empty = u.cells.filter((c) => !g.values[c]);
        if (empty.length <= n) continue;
        const digitPos = new Map<number, number[]>();
        for (let d = 1; d <= 9; d++) {
          if (placedInUnit(g, u, d)) continue;
          const pos = positions(g, u, d);
          if (pos.length >= 1 && pos.length <= n) digitPos.set(d, pos);
        }
        if (digitPos.size < n) continue;
        for (const ds of combinations([...digitPos.keys()], n)) {
          const cellSet = new Set<number>();
          for (const d of ds) for (const c of digitPos.get(d)!) cellSet.add(c);
          if (cellSet.size !== n) continue;
          const cells = [...cellSet].sort((a, b) => a - b);
          const keep = ds.reduce((m, d) => m | bit(d), 0);
          const eliminations: CellDigit[] = [];
          for (const c of cells) for (const d of digitsOf(g.cands[c] & ~keep)) eliminations.push({ cell: c, digit: d });
          if (!eliminations.length) continue;
          return {
            technique: name,
            level,
            placements: [],
            eliminations,
            cells,
            candidates: cells.flatMap((cell) => digitsOf(g.cands[cell] & keep).map((digit) => ({ cell, digit }))),
            units: [unitIdx(u)],
            nudge: `There is a ${name.toLowerCase()} in ${unitName(u)}.`,
            explanation: `In ${unitName(u)}, the digits ${listJoin(ds)} can only go in the ${n} cells ${cellList(cells)}. Those cells must hold exactly these ${n} digits, so all other candidates can be removed from them.`,
          };
        }
      }
      return null;
    },
  };
}


function blockHint(cell: number): string {
  return `box ${boxOf(cell) + 1}`;
}
