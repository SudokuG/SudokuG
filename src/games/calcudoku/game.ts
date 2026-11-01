// Calcudoku: the board (cells with thick cage borders and a label in each cage's first cell),
// cage states, printing. The logic is in engine.ts and logic.ts; the page is ../lite.ts.

import { FONT, svgCell } from "../draw";
import type { LiteGame } from "../lite";
import { CALC_SIZES, decodeCalc, encodeCalc, isCalcCode, meets } from "./engine";
import type { CalcPuzzle } from "./engine";
import { CALC_EXAMPLES } from "./examples";
import { CALC_LEVELS, applyStep, makeCalc, nextStep, place, rateCalc, startState } from "./logic";
import type { CalcLevel } from "./logic";
import { CALC_TECHNIQUES } from "./techniques";

const label = (p: CalcPuzzle, k: number) => {
  const c = p.cages[k];
  return c.op === "=" ? "" : `${c.target}${c.op}`;
};

/** Which sides of cell i border another cage (or the edge): top, right, bottom, left. */
function edges(p: CalcPuzzle, i: number): [boolean, boolean, boolean, boolean] {
  const { n, cageOf } = p;
  const r = Math.floor(i / n);
  const c = i % n;
  const k = cageOf[i];
  return [r === 0 || cageOf[i - n] !== k, c === n - 1 || cageOf[i + 1] !== k, r === n - 1 || cageOf[i + n] !== k, c === 0 || cageOf[i - 1] !== k];
}

export function calcSvg(p: CalcPuzzle, entries?: number[], cands?: number[]): string {
  const N = p.n;
  const C = 100;
  const W = N * C;
  const thin: string[] = [];
  const thick: string[] = [];
  for (let i = 0; i < N * N; i++) {
    const x = (i % N) * C;
    const y = Math.floor(i / N) * C;
    const [t, r, b, l] = edges(p, i);
    (t ? thick : thin).push(`M${x} ${y}H${x + C}`);
    (l ? thick : thin).push(`M${x} ${y}V${y + C}`);
    if (r) thick.push(`M${x + C} ${y}V${y + C}`);
    if (b) thick.push(`M${x} ${y + C}H${x + C}`);
  }
  const t: string[] = [];
  p.cages.forEach((c, k) => {
    const first = Math.min(...c.cells);
    const text = label(p, k);
    if (text) t.push(`<text x="${(first % N) * C + 9}" y="${Math.floor(first / N) * C + 27}" font-size="22" font-weight="700" fill="#000">${text}</text>`);
  });
  for (let i = 0; i < N * N; i++) {
    const given = p.givens[i];
    const v = given ? p.solution[i] : entries ? entries[i] : -1;
    t.push(svgCell((i % N) * C + 50, Math.floor(i / N) * C + 56, given, v, cands?.[i] ?? 0, N));
  }
  const pad = 4;
  return `<svg class="pz-grid" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${W + 2 * pad}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Calcudoku puzzle"><rect x="${-pad}" y="${-pad}" width="${W + 2 * pad}" height="${W + 2 * pad}" fill="#fff"/><path d="${thin.join("")}" stroke="#9aa3ad" stroke-width="2" fill="none"/><path d="${thick.join("")}" stroke="#111" stroke-width="6" stroke-linecap="square" fill="none"/><g font-family='${FONT}'>${t.join("")}</g></svg>`;
}

export const CALCUDOKU: LiteGame<CalcPuzzle> = {
  id: "calcudoku",
  title: "Calcudoku",
  noun: "puzzle",
  sizes: CALC_SIZES,
  defaultSize: 6,
  levels: CALC_LEVELS,
  maxDigit: (n) => n,
  xPerLine: 0,
  codeHint: "K6-…",
  rules: `
    <p>Every row and column holds the digits <b>1 to n</b> once each (1 to 6 on a 6×6 board).</p>
    <p>The thick lines make cages. The label in a cage's corner gives a target and an operation: the digits in it add up to the target (+), multiply to it (×), or, in a cage of two cells, differ by it (−) or divide to it (÷), in either order. A cage of one cell is given.</p>
    <p>A digit may appear twice in a cage, as long as not in the same row or column. A cage label turns grey when its cage is full and right, red when it is full and wrong.</p>`,
  make: (n, level, rnd) => makeCalc(n, level as CalcLevel, rnd),
  levelOf: (p) => rateCalc(p)?.level ?? "Unrated",
  encode: encodeCalc,
  decode: decodeCalc,
  isCode: isCalcCode,
  layout(board, p, cell) {
    board.style.gridTemplateColumns = `repeat(${p.n}, 1fr)`;
    const firsts = new Set(p.cages.map((c) => Math.min(...c.cells)));
    for (let i = 0; i < p.n * p.n; i++) {
      const wrap = document.createElement("div");
      // Each cell draws its top and left line (thick at a cage edge); the last column and row
      // also draw the outer edge, so no line is drawn twice.
      const [t, , , l] = edges(p, i);
      const lastCol = i % p.n === p.n - 1;
      const lastRow = i >= p.n * (p.n - 1);
      wrap.className = `calc-wrap${t ? " bt" : ""}${l ? " bl" : ""}${lastCol ? " br" : ""}${lastRow ? " bb" : ""}`;
      wrap.appendChild(cell(i));
      if (firsts.has(i) && label(p, p.cageOf[i])) {
        const tag = document.createElement("span");
        tag.className = "calc-label";
        tag.dataset.k = String(p.cageOf[i]);
        tag.textContent = label(p, p.cageOf[i]);
        wrap.appendChild(tag);
      }
      board.appendChild(wrap);
    }
  },
  decorate(board, p, cells) {
    board.querySelectorAll<HTMLElement>(".calc-label").forEach((tag) => {
      const c = p.cages[Number(tag.dataset.k)];
      const ds = c.cells.map((i) => cells[i]);
      const full = ds.every((v) => v > 0);
      tag.classList.toggle("done", full && meets(c, ds));
      tag.classList.toggle("bad", full && !meets(c, ds));
    });
  },
  svg: calcSvg,
  solver: (p) => ({
    start: () => startState(p),
    place: (s, i, v) => place(p, s, i, v),
    next: (s) => nextStep(p, s),
    apply: (s, st) => applyStep(p, s, st),
  }),
  techniques: CALC_TECHNIQUES,
  examples: CALC_EXAMPLES,
  hintToPlacement: true,
};
