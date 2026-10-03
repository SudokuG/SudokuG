// Simple Coloring (single-digit coloring).
//
// For one digit d, a "conjugate pair" is a unit where d has exactly two possible cells:
// one of them is d, the other is not. Chaining conjugate pairs together, you can give
// the cells two colors so that linked cells always have different colors. Then either
// every cell of color A is d, or every cell of color B is d.
//
//  - Color trap: a cell outside the chain that sees a cell of each color can't be d.
//  - Color wrap: if two cells of the same color see each other, that color can't be d
//    (two d's in one unit), so d is removed from every cell of that color.

import { UNITS, cellList, cellName } from "./grid";
import type { Link, Technique } from "./types";
import { hasCand, positions, sees } from "./util";

export const simpleColoring = (level: number): Technique => ({
  name: "Simple Coloring",
  level,
  find(g) {
    for (let d = 1; d <= 9; d++) {
      // Build the conjugate-pair graph for digit d.
      const adj = new Map<number, Set<number>>();
      const edges: [number, number][] = [];
      for (const u of UNITS) {
        const pos = positions(g, u, d);
        if (pos.length !== 2) continue;
        const [a, b] = pos;
        if (adj.get(a)?.has(b)) continue;
        if (!adj.has(a)) adj.set(a, new Set());
        if (!adj.has(b)) adj.set(b, new Set());
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
        edges.push([a, b]);
      }
      const color = new Map<number, 0 | 1>();
      for (const start of adj.keys()) {
        if (color.has(start)) continue;
        // Two-color one connected component.
        const comp: number[] = [];
        const queue = [start];
        color.set(start, 0);
        while (queue.length) {
          const c = queue.shift()!;
          comp.push(c);
          for (const n of adj.get(c)!) {
            if (color.has(n)) continue;
            color.set(n, (1 - color.get(c)!) as 0 | 1);
            queue.push(n);
          }
        }
        if (comp.length < 4) continue; // shorter chains are covered by simpler techniques
        const inComp = new Set(comp);
        const ofColor = (k: 0 | 1) => comp.filter((c) => color.get(c) === k);
        const marks = comp.map((cell) => ({ cell, digit: d, color: color.get(cell)! }));
        const links: Link[] = edges
          .filter(([a, b]) => inComp.has(a) && inComp.has(b))
          .map(([a, b]) => ({ from: { cell: a, digit: d }, to: { cell: b, digit: d }, strong: true }));
        const base = {
          technique: "Simple Coloring",
          level,
          placements: [],
          cells: comp,
          candidates: [],
          units: [],
          colors: marks,
          links,
          nudge: `Try coloring the ${d}s: follow the units where ${d} has only two places.`,
        };

        // Color wrap
        for (const k of [0, 1] as const) {
          const same = ofColor(k);
          let clash: [number, number] | null = null;
          for (let i = 0; i < same.length && !clash; i++)
            for (let j = i + 1; j < same.length; j++)
              if (sees(same[i], same[j])) {
                clash = [same[i], same[j]];
                break;
              }
          if (!clash) continue;
          const name = k === 0 ? "blue" : "pink";
          const other = k === 0 ? "pink" : "blue";
          return {
            ...base,
            eliminations: same.map((cell) => ({ cell, digit: d })),
            explanation:
              `Follow the conjugate pairs of ${d} (units where ${d} has exactly two places) and color them alternately blue and pink. ` +
              `Exactly one color holds the ${d}s. The ${name} cells ${cellName(clash[0])} and ${cellName(clash[1])} see each other, ` +
              `so they can't both be ${d}: ${name} is false. Remove ${d} from all ${name} cells; the ${other} cells are ${d}.`,
          };
        }

        // Color trap
        const blue = ofColor(0);
        const pink = ofColor(1);
        const trapped: number[] = [];
        for (let c = 0; c < 81; c++) {
          if (inComp.has(c) || !hasCand(g, c, d)) continue;
          if (blue.some((b) => sees(b, c)) && pink.some((p) => sees(p, c))) trapped.push(c);
        }
        if (trapped.length)
          return {
            ...base,
            eliminations: trapped.map((cell) => ({ cell, digit: d })),
            explanation:
              `Follow the conjugate pairs of ${d} (units where ${d} has exactly two places) and color them alternately blue and pink. ` +
              `Exactly one color holds the ${d}s. ${cellList(trapped)} ${trapped.length === 1 ? "sees" : "see"} both a blue and a pink cell, ` +
              `so whichever color is true, ${trapped.length === 1 ? "it" : "they"} can't be ${d}.`,
          };
      }
    }
    return null;
  },
});

