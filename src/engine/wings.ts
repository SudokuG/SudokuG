// XY-Wing and XYZ-Wing.

import { Grid, bit, cellList, cellName, digitsOf, popcount } from "./grid";
import type { CellDigit, Technique } from "./types";
import { hasCand, sees } from "./util";

const empties = (g: Grid) => [...Array(81).keys()].filter((c) => !g.values[c]);

/**
 * XY-Wing: a pivot cell with candidates {x,y} sees two "pincer" cells {x,z} and {y,z}.
 * Whatever the pivot is, one of the pincers must be z, so z can be removed
 * from every cell that sees both pincers.
 */
export const xyWing = (level: number): Technique => ({
  name: "XY-Wing",
  level,
  find(g) {
    const bivalue = empties(g).filter((c) => popcount(g.cands[c]) === 2);
    for (const pivot of bivalue) {
      const [x, y] = digitsOf(g.cands[pivot]);
      const wings = bivalue.filter((c) => c !== pivot && sees(c, pivot));
      for (const p1 of wings) {
        if (!(g.cands[p1] & bit(x)) || g.cands[p1] & bit(y)) continue;
        const z = digitsOf(g.cands[p1] & ~bit(x))[0];
        for (const p2 of wings) {
          if (p2 === p1 || g.cands[p2] !== (bit(y) | bit(z))) continue;
          const elim = empties(g).filter((c) => c !== p1 && c !== p2 && c !== pivot && hasCand(g, c, z) && sees(c, p1) && sees(c, p2));
          if (!elim.length) continue;
          return {
            technique: "XY-Wing",
            level,
            placements: [],
            eliminations: elim.map((cell) => ({ cell, digit: z })),
            cells: [pivot, p1, p2],
            candidates: [
              { cell: pivot, digit: x },
              { cell: pivot, digit: y },
              { cell: p1, digit: x },
              { cell: p2, digit: y },
            ],
            colors: [
              { cell: p1, digit: z, color: 0 },
              { cell: p2, digit: z, color: 0 },
            ],
            links: [
              { from: { cell: pivot, digit: x }, to: { cell: p1, digit: x }, strong: false },
              { from: { cell: pivot, digit: y }, to: { cell: p2, digit: y }, strong: false },
            ],
            units: [],
            nudge: `There is an XY-Wing. Look for three cells with two candidates each, around ${cellName(pivot)}.`,
            explanation:
              `The pivot ${cellName(pivot)} is ${x} or ${y}. If it is ${x}, then ${cellName(p1)} (${x}/${z}) must be ${z}. ` +
              `If it is ${y}, then ${cellName(p2)} (${y}/${z}) must be ${z}. Either way one of the two wings is ${z}, ` +
              `so ${z} can be removed from every cell that sees both wings: ${cellList(elim)}.`,
          };
        }
      }
    }
    return null;
  },
});

/**
 * XYZ-Wing: a pivot {x,y,z} sees wings {x,z} and {y,z}. One of the three cells is z,
 * so z can be removed from cells that see all three.
 */
export const xyzWing = (level: number): Technique => ({
  name: "XYZ-Wing",
  level,
  find(g) {
    const cells = empties(g);
    const bivalue = cells.filter((c) => popcount(g.cands[c]) === 2);
    for (const pivot of cells) {
      if (popcount(g.cands[pivot]) !== 3) continue;
      const pm = g.cands[pivot];
      const wings = bivalue.filter((c) => sees(c, pivot) && (g.cands[c] & ~pm) === 0);
      for (let i = 0; i < wings.length; i++)
        for (let j = i + 1; j < wings.length; j++) {
          const p1 = wings[i];
          const p2 = wings[j];
          if (g.cands[p1] === g.cands[p2]) continue;
          const common = g.cands[p1] & g.cands[p2];
          if (popcount(common) !== 1) continue;
          const z = digitsOf(common)[0];
          const elim = cells.filter(
            (c) => c !== pivot && c !== p1 && c !== p2 && hasCand(g, c, z) && sees(c, pivot) && sees(c, p1) && sees(c, p2),
          );
          if (!elim.length) continue;
          const [x] = digitsOf(g.cands[p1] & ~bit(z));
          const [y] = digitsOf(g.cands[p2] & ~bit(z));
          const cand: CellDigit[] = [pivot, p1, p2].flatMap((cell) => digitsOf(g.cands[cell] & ~bit(z)).map((digit) => ({ cell, digit })));
          return {
            technique: "XYZ-Wing",
            level,
            placements: [],
            eliminations: elim.map((cell) => ({ cell, digit: z })),
            cells: [pivot, p1, p2],
            candidates: cand,
            colors: [pivot, p1, p2].map((cell) => ({ cell, digit: z, color: 0 as const })),
            units: [],
            nudge: `There is an XYZ-Wing around ${cellName(pivot)}.`,
            explanation:
              `The pivot ${cellName(pivot)} is ${x}, ${y} or ${z}. If it is ${x}, ${cellName(p1)} becomes ${z}; ` +
              `if it is ${y}, ${cellName(p2)} becomes ${z}; otherwise the pivot itself is ${z}. ` +
              `So one of these three cells is ${z}, and ${z} can be removed from cells that see all three: ${cellList(elim)}.`,
          };
        }
    }
    return null;
  },
});
