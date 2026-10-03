// Chains (alternating inference chains).
//
// A chain is a sequence of candidates linked alternately by strong and weak links:
//   strong link (=): at least one of the two candidates is true
//       - a cell with exactly two candidates (bivalue cell), or
//       - a digit with exactly two places in a unit (conjugate pair)
//   weak link (−): at most one of the two is true
//       - two candidates in the same cell, or
//       - the same digit in two cells that see each other
//
// A chain that starts and ends with a strong link proves: the first candidate OR the
// last candidate is true. ("If the first is false, the next is true, so the next is
// false, ..., so the last is true.") Anything that conflicts with both ends can go.
//
// The same search covers several named techniques by limiting which links are allowed:
//   X-Chain (and its short forms Skyscraper, 2-String Kite, Turbot Fish): one digit, conjugate pairs only
//   Two-Digit Chain: any links, but only candidates of two digits
//   XY-Chain: bivalue cells as strong links, same digit between cells as weak links
//   AIC: everything

import { ALL, BOXES, COLS, Grid, ROWS, Unit, bit, boxOf, cellList, cellName, colOf, popcount, rowOf } from "./grid";
import type { CellDigit, Link, Step, Technique } from "./types";
import { cdName, hasCand, positions, sees } from "./util";

const nodeOf = (cell: number, d: number) => cell * 9 + d - 1;
const cellOfNode = (n: number) => Math.floor(n / 9);
const digitOfNode = (n: number) => (n % 9) + 1;
const CELL_UNITS: Unit[][] = Array.from({ length: 81 }, (_, c) => [ROWS[rowOf(c)], COLS[colOf(c)], BOXES[boxOf(c)]]);

interface LinkRules {
  strongCell: boolean; // bivalue cells
  strongUnit: boolean; // conjugate pairs
  weakCell: boolean; // two digits in one cell
  weakUnit: boolean; // same digit in cells that see each other
}

/** Candidates-graph of the grid. Only digits in `digitMask` take part. */
function buildGraph(g: Grid, rules: LinkRules, digitMask = ALL) {
  const strong: number[][] = Array.from({ length: 729 }, () => []);
  const weak: number[][] = Array.from({ length: 729 }, () => []);
  for (let c = 0; c < 81; c++) {
    if (g.values[c]) continue;
    for (let d = 1; d <= 9; d++) {
      if (!hasCand(g, c, d) || !(digitMask & bit(d))) continue;
      const n = nodeOf(c, d);
      if (rules.strongCell && popcount(g.cands[c]) === 2)
        for (let e = 1; e <= 9; e++) if (e !== d && hasCand(g, c, e) && digitMask & bit(e)) strong[n].push(nodeOf(c, e));
      if (rules.strongUnit)
        for (const u of CELL_UNITS[c]) {
          const pos = positions(g, u, d);
          if (pos.length !== 2) continue;
          const other = nodeOf(pos[0] === c ? pos[1] : pos[0], d);
          if (!strong[n].includes(other)) strong[n].push(other);
        }
      if (rules.weakCell)
        for (let e = 1; e <= 9; e++) if (e !== d && hasCand(g, c, e) && digitMask & bit(e)) weak[n].push(nodeOf(c, e));
      if (rules.weakUnit) for (let p = 0; p < 81; p++) if (sees(c, p) && hasCand(g, p, d)) weak[n].push(nodeOf(p, d));
    }
  }
  return { strong, weak };
}

/** What can be removed when we know: candidate a OR candidate b is true. */
function eliminationsFor(g: Grid, a: number, b: number): CellDigit[] {
  const ca = cellOfNode(a), da = digitOfNode(a), cb = cellOfNode(b), db = digitOfNode(b);
  const out: CellDigit[] = [];
  if (ca !== cb && da === db) {
    for (let c = 0; c < 81; c++) if (c !== ca && c !== cb && hasCand(g, c, da) && sees(c, ca) && sees(c, cb)) out.push({ cell: c, digit: da });
  } else if (ca === cb) {
    for (let d = 1; d <= 9; d++) if (d !== da && d !== db && hasCand(g, ca, d)) out.push({ cell: ca, digit: d });
  } else if (sees(ca, cb)) {
    if (hasCand(g, ca, db)) out.push({ cell: ca, digit: db });
    if (hasCand(g, cb, da)) out.push({ cell: cb, digit: da });
  }
  return out;
}

interface Found {
  path: number[];
  elims: CellDigit[];
}

/**
 * Breadth-first search for the shortest chain (in candidates) that eliminates something.
 * Chains always start with a strong link and end with a strong link, so they have an even
 * number of candidates, between minNodes and maxNodes.
 */
function findChain(
  g: Grid,
  rules: LinkRules,
  minNodes: number,
  maxNodes: number,
  accept?: (path: number[]) => boolean,
  digitMask = ALL,
): Found | null {
  const { strong, weak } = buildGraph(g, rules, digitMask);
  let best: Found | null = null;
  for (let s = 0; s < 729; s++) {
    if (!strong[s].length) continue;
    if (best && best.path.length <= minNodes) break;
    // state = node*2 + parity; parity 1 = reached through a strong link
    const prev = new Map<number, number>();
    const depth = new Map<number, number>();
    const startState = s * 2;
    prev.set(startState, -1);
    depth.set(startState, 0);
    const queue = [startState];
    let found = false;
    for (let qi = 0; qi < queue.length && !found; qi++) {
      const st = queue[qi];
      const node = st >> 1;
      const par = st & 1;
      const dep = depth.get(st)!;
      const count = dep + 2; // candidates in the chain after one more link
      if (count > maxNodes) break;
      if (best && count >= best.path.length) break;
      const next = par === 0 ? strong[node] : weak[node];
      for (const nx of next) {
        const nst = nx * 2 + (1 - par);
        if (prev.has(nst)) continue;
        prev.set(nst, st);
        depth.set(nst, dep + 1);
        if (par === 0 && count >= minNodes && nx !== s) {
          const path: number[] = [];
          for (let x = nst; x !== -1; x = prev.get(x)!) path.push(x >> 1);
          path.reverse();
          if (new Set(path).size === path.length && (!accept || accept(path))) {
            const elims = eliminationsFor(g, s, nx);
            if (elims.length) {
              best = { path, elims };
              found = true;
              break;
            }
          }
        }
        queue.push(nst);
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Turning a found chain into a Step

function describe(path: number[]): { notation: string; narrative: string; links: Link[] } {
  const cd = (n: number): CellDigit => ({ cell: cellOfNode(n), digit: digitOfNode(n) });
  let notation = cdName(cellOfNode(path[0]), digitOfNode(path[0]));
  const parts: string[] = [`If ${cellName(cellOfNode(path[0]))} is not ${digitOfNode(path[0])}`];
  const links: Link[] = [];
  for (let i = 1; i < path.length; i++) {
    const strong = i % 2 === 1;
    notation += (strong ? " = " : " − ") + cdName(cellOfNode(path[i]), digitOfNode(path[i]));
    parts.push(strong ? `then ${cellName(cellOfNode(path[i]))} is ${digitOfNode(path[i])}` : `so ${cellName(cellOfNode(path[i]))} is not ${digitOfNode(path[i])}`);
    links.push({ from: cd(path[i - 1]), to: cd(path[i]), strong });
  }
  return { notation, narrative: parts.join(", ") + ".", links };
}

function reason(a: number, b: number, elims: CellDigit[]): string {
  const ca = cellOfNode(a), da = digitOfNode(a), cb = cellOfNode(b), db = digitOfNode(b);
  const ends = `So ${cellName(ca)} is ${da} or ${cellName(cb)} is ${db} (or both).`;
  if (da === db && ca !== cb)
    return `${ends} Any cell that sees both ends can't be ${da}: ${cellList(elims.map((e) => e.cell))}.`;
  if (ca === cb)
    return `${ends} So ${cellName(ca)} is ${da} or ${db}, and its other candidates can go.`;
  return `${ends} These two cells see each other, so ${elims.map((e) => `${cellName(e.cell)} can't be ${e.digit}`).join(" and ")}.`;
}

function toStep(name: string, level: number, nudge: string, f: Found, intro: string): Step {
  const { notation, narrative, links } = describe(f.path);
  const a = f.path[0];
  const b = f.path[f.path.length - 1];
  return {
    technique: name,
    level,
    placements: [],
    eliminations: f.elims,
    cells: [...new Set(f.path.map(cellOfNode))],
    candidates: f.path.map((n) => ({ cell: cellOfNode(n), digit: digitOfNode(n) })),
    units: [],
    links,
    notation,
    chainDigits: chainDigits(f.path),
    nudge,
    explanation: `${intro} ${narrative} ${reason(a, b, f.elims)}`,
  };
}

const X_RULES: LinkRules = { strongCell: false, strongUnit: true, weakCell: false, weakUnit: true };
const XY_RULES: LinkRules = { strongCell: true, strongUnit: false, weakCell: false, weakUnit: true };
const AIC_RULES: LinkRules = { strongCell: true, strongUnit: true, weakCell: true, weakUnit: true };

function lineOf(a: number, b: number): "row" | "column" | "box" {
  if (rowOf(a) === rowOf(b)) return "row";
  if (colOf(a) === colOf(b)) return "column";
  return "box";
}

/** Two conjugate pairs of one digit joined by a weak link: Skyscraper, 2-String Kite or Turbot Fish. */
export const shortXChain = (level: number): Technique => ({
  name: "Skyscraper / 2-String Kite",
  level,
  find(g) {
    const f = findChain(g, X_RULES, 4, 4);
    if (!f) return null;
    const [p0, p1, p2, p3] = f.path.map(cellOfNode);
    const d = digitOfNode(f.path[0]);
    const k1 = lineOf(p0, p1);
    const k2 = lineOf(p2, p3);
    let name = "Turbot Fish";
    if (k1 !== "box" && k1 === k2) name = "Skyscraper";
    else if (k1 !== "box" && k2 !== "box" && boxOf(p1) === boxOf(p2)) name = "2-String Kite";
    const intro = `Two units each have exactly two places for ${d}, and one end of each sees the other.`;
    return toStep(name, level, `Look at the ${d}s: two units where ${d} has only two places are connected.`, f, intro);
  },
});

export const xChain = (level: number): Technique => ({
  name: "X-Chain",
  level,
  find(g) {
    const f = findChain(g, X_RULES, 6, 12);
    if (!f) return null;
    const d = digitOfNode(f.path[0]);
    return toStep(
      "X-Chain",
      level,
      `There is a chain on digit ${d}, using units where ${d} has only two places.`,
      f,
      `This chain uses only the digit ${d}.`,
    );
  },
});

export const xyChain = (level: number): Technique => ({
  name: "XY-Chain",
  level,
  find(g) {
    const f = findChain(g, XY_RULES, 8, 14);
    if (!f) return null;
    return toStep(
      "XY-Chain",
      level,
      `There is a chain through cells with two candidates, starting at ${cellName(cellOfNode(f.path[0]))}.`,
      f,
      `This chain runs through cells with exactly two candidates.`,
    );
  },
});

export const aic = (level: number): Technique => ({
  name: "Alternating Inference Chain",
  level,
  find(g) {
    const f = findChain(g, AIC_RULES, 6, 12);
    if (!f) return null;
    return toStep(
      "Alternating Inference Chain",
      level,
      `There is a chain that mixes two-candidate cells and two-place units, starting at ${cellName(cellOfNode(f.path[0]))}.`,
      f,
      `Strong links (=) mean at least one is true; weak links (−) mean at most one is true.`,
    );
  },
});

/** Number of different digits a chain uses. */
export const chainDigits = (path: number[]) => new Set(path.map(digitOfNode)).size;

/**
 * A chain that uses only two digits (any link types). These are often easy to follow,
 * for example when the same pair of digits keeps appearing. Chains of one digit are
 * X-Chains; chains with three or more digits are XY-Chains or AICs.
 */
export const twoDigitChain = (level: number): Technique => ({
  name: "Two-Digit Chain",
  level,
  find(g) {
    let best: Found | null = null;
    let bestPair: [number, number] = [0, 0];
    for (let a = 1; a <= 9 && !(best && best.path.length <= 4); a++)
      for (let b = a + 1; b <= 9; b++) {
        const max = best ? best.path.length - 2 : 14;
        if (max < 4) break;
        const f = findChain(g, AIC_RULES, 4, max, (p) => chainDigits(p) === 2, bit(a) | bit(b));
        if (f && (!best || f.path.length < best.path.length)) {
          best = f;
          bestPair = [a, b];
        }
      }
    if (!best) return null;
    const [a, b] = bestPair;
    return toStep(
      "Two-Digit Chain",
      level,
      `There is a chain that uses only the digits ${a} and ${b}.`,
      best,
      `This chain uses only the digits ${a} and ${b}.`,
    );
  },
});
