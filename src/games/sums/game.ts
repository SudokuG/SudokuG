// Treasure Map (the puzzle family is known as Japanese Sums; Denksport Logisch calls it
// "Japans vierkant"): the board with clues on the left and on top, clue states, printing.
// The logic is in engine.ts; the page is the shared one in ../lite.ts.

import { FONT, svgCell } from "../draw";
import type { LiteGame } from "../lite";
import { liteHint } from "../logic";
import { SUMS_SIZES, decodeSums, encodeSums, isSumsCode, runSums } from "./engine";
import type { SumsPuzzle } from "./engine";
import { SUMS_LEVELS, applyStep, makeSums, nextStep, place, rateSumsPuzzle, startState } from "./logic";
import type { SumsLevel } from "./logic";

/** "done" when a complete line adds up, "bad" when it can't, "" otherwise. */
function lineState(cells: number[], clue: number[]): "" | "done" | "bad" {
  const digits = cells.filter((v) => v > 0);
  const xs = cells.filter((v) => v === 0).length;
  if (new Set(digits).size !== digits.length || xs > 2) return "bad";
  if (cells.some((v) => v < 0)) return "";
  const sums = runSums(cells);
  return sums.length === clue.length && sums.every((x, k) => x === clue[k]) ? "done" : "bad";
}

export function sumsSvg(p: SumsPuzzle, entries?: number[], cands?: number[]): string {
  const N = p.n;
  const C = 100; // cell
  // Margin for the clues (left and top): room for the longest row clue and three column clues.
  const longest = Math.max(...p.rowClues.map((rc) => rc.join("  ").length));
  const M = Math.max(130, 30 + longest * 19);
  const W = M + N * C;
  const t: string[] = [];
  for (let k = 0; k < N; k++) {
    const rc = p.rowClues[k];
    t.push(`<text x="${M - 14}" y="${M + k * C + 62}" text-anchor="end" font-size="${rc.length > 2 ? 34 : 38}" font-weight="700" fill="#000">${rc.join("  ")}</text>`);
    const cc = p.colClues[k];
    cc.forEach((x, j) => t.push(`<text x="${M + k * C + 50}" y="${M - 14 - (cc.length - 1 - j) * 34}" text-anchor="middle" font-size="${cc.length > 2 ? 30 : 34}" font-weight="700" fill="#000">${x}</text>`));
  }
  for (let i = 0; i < N * N; i++) {
    const given = p.givens[i];
    const v = given ? p.solution[i] : entries ? entries[i] : -1;
    t.push(svgCell(M + (i % N) * C + 50, M + Math.floor(i / N) * C + 50, given, v, cands?.[i] ?? 0, N - 2));
  }
  const lines: string[] = [];
  for (let k = 1; k < N; k++) lines.push(`M${M + k * C} ${M}V${W}M${M} ${M + k * C}H${W}`);
  return `<svg class="pz-grid" viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Treasure Map puzzle"><rect width="${W}" height="${W}" fill="#fff"/><path d="${lines.join("")}" stroke="#555" stroke-width="3" fill="none"/><rect x="${M}" y="${M}" width="${N * C}" height="${N * C}" stroke="#111" stroke-width="7" fill="none"/><g font-family='${FONT}'>${t.join("")}</g></svg>`;
}

export const TREASURE_MAP: LiteGame<SumsPuzzle> = {
  id: "sums",
  title: "Treasure Map",
  noun: "map",
  sizes: SUMS_SIZES,
  defaultSize: 7,
  levels: SUMS_LEVELS,
  maxDigit: (n) => n - 2,
  xPerLine: 2,
  codeHint: "J7-…",
  rules: `
    <p>Every row and column holds the digits <b>1 to n−2</b> once each (1 to 5 on a 7×7 map), and two <b>X</b>'s.</p>
    <p>The numbers left of a row and above a column are the sums of its groups of digits, in order from left to right or top to bottom. The X's split the groups. A single number equal to the sum of all digits means the X's are at the ends or next to each other.</p>
    <p>Much of the work is finding where the X's can and can't be. Mark a cell with a dot (•) when you know it holds a digit. A clue turns grey when its line adds up, red when it can't.</p>
    <p>Every map has exactly one solution and can be solved by reasoning alone; the difficulty comes from how much has to be worked out, not from the size.</p>
    <p class="aside">Puzzle fans know this kind as <i>Japanese Sums</i>; Denksport Logisch calls it “Japans vierkant”.</p>`,
  make: (n, level, rnd) => makeSums(n, level as SumsLevel, rnd),
  levelOf: (p) => rateSumsPuzzle(p)?.level ?? "Unrated",
  hint: (p, cells, cands) =>
    liteHint({
      n: p.n,
      solution: p.solution,
      givens: p.givens,
      cells,
      cands,
      start: () => startState(p),
      place: (s, i, v) => place(p, s, i, v),
      next: (s) => nextStep(p, s),
      apply: (s, st) => applyStep(p, s, st),
    }),
  encode: encodeSums,
  decode: decodeSums,
  isCode: isSumsCode,
  layout(board, p, cell) {
    const N = p.n;
    board.appendChild(Object.assign(document.createElement("div"), { className: "sums-corner" }));
    for (let c = 0; c < N; c++) {
      const el = document.createElement("div");
      el.className = "sums-clue col";
      el.innerHTML = p.colClues[c].map((x) => `<span>${x}</span>`).join("");
      board.appendChild(el);
    }
    for (let r = 0; r < N; r++) {
      const el = document.createElement("div");
      el.className = "sums-clue row";
      el.innerHTML = p.rowClues[r].map((x) => `<span>${x}</span>`).join("");
      board.appendChild(el);
      for (let c = 0; c < N; c++) {
        const ce = cell(r * N + c);
        if (c === N - 1) ce.classList.add("last-col");
        if (r === N - 1) ce.classList.add("last-row");
        board.appendChild(ce);
      }
    }
  },
  decorate(board, p, cells, sel) {
    const N = p.n;
    const rows = board.querySelectorAll<HTMLElement>(".sums-clue.row");
    const cols = board.querySelectorAll<HTMLElement>(".sums-clue.col");
    for (let k = 0; k < N; k++) {
      const rs = lineState(cells.slice(k * N, k * N + N), p.rowClues[k]);
      const cs = lineState(Array.from({ length: N }, (_, r) => cells[r * N + k]), p.colClues[k]);
      rows[k].className = `sums-clue row${rs ? " " + rs : ""}${k === Math.floor(sel / N) ? " on" : ""}`;
      cols[k].className = `sums-clue col${cs ? " " + cs : ""}${k === sel % N ? " on" : ""}`;
    }
  },
  svg: sumsSvg,
};
