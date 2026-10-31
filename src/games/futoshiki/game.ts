// Futoshiki: the board (cells with signs in the gaps between them), sign states, printing.
// The logic is in engine.ts; the page is the shared one in ../lite.ts.

import { FONT, svgCell } from "../draw";
import type { LiteGame } from "../lite";
import { FUTOSHIKI_SIZES, decodeFutoshiki, encodeFutoshiki, generateFutoshiki, isFutoshikiCode, pairsOf } from "./engine";
import type { FutoshikiPuzzle } from "./engine";

/** Gap between cells, as a fraction of a cell. */
const GAP = 0.42;

/** Extra clues given back per difficulty (minimal puzzles can be tough). */
const EXTRA: Record<string, number> = { Easy: 6, Medium: 2, Hard: 0 };

/**
 * The chevron for a sign between cells a and b, pointing at the smaller one: in a gap
 * between two cells side by side "<" or ">", between a cell and the one below "∧" or "∨".
 * Drawn in a 10×10 box.
 */
function chevron(p: FutoshikiPuzzle, a: number, b: number): string {
  const vertical = b - a === p.n;
  const aSmaller = p.solution[a] < p.solution[b];
  if (!vertical) return aSmaller ? "M7 1.8L3 5L7 8.2" : "M3 1.8L7 5L3 8.2";
  return aSmaller ? "M1.8 7L5 3L8.2 7" : "M1.8 3L5 7L8.2 3";
}

export function futoshikiSvg(p: FutoshikiPuzzle, entries?: number[], cands?: number[]): string {
  const N = p.n;
  const C = 100;
  const G = C * GAP;
  const W = N * C + (N - 1) * G;
  const at = (k: number) => k * (C + G);
  const t: string[] = [];
  for (let i = 0; i < N * N; i++) {
    const x = at(i % N);
    const y = at(Math.floor(i / N));
    const given = p.givens[i];
    t.push(`<rect x="${x + 3}" y="${y + 3}" width="${C - 6}" height="${C - 6}" rx="10" fill="#fff" stroke="#111" stroke-width="${given ? 6 : 4}"/>`);
    const v = given ? p.solution[i] : entries ? entries[i] : -1;
    t.push(svgCell(x + C / 2, y + C / 2, given, v, cands?.[i] ?? 0, N));
  }
  pairsOf(N).forEach(([a, b], k) => {
    if (!p.signs[k]) return;
    const vertical = b - a === N;
    // The 10×10 chevron box, scaled up and centred in the gap.
    const s = 4.2;
    const cx = vertical ? at(a % N) + C / 2 : at(a % N) + C + G / 2;
    const cy = vertical ? at(Math.floor(a / N)) + C + G / 2 : at(Math.floor(a / N)) + C / 2;
    t.push(`<path d="${chevron(p, a, b)}" transform="translate(${cx - 5 * s} ${cy - 5 * s}) scale(${s})" fill="none" stroke="#000" stroke-width="${5 / s}" stroke-linecap="round" stroke-linejoin="round"/>`);
  });
  const pad = 6;
  return `<svg class="pz-grid" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${W + 2 * pad}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Futoshiki puzzle"><rect x="${-pad}" y="${-pad}" width="${W + 2 * pad}" height="${W + 2 * pad}" fill="#fff"/><g font-family='${FONT}'>${t.join("")}</g></svg>`;
}

export const FUTOSHIKI: LiteGame<FutoshikiPuzzle> = {
  id: "futoshiki",
  title: "Futoshiki",
  noun: "puzzle",
  sizes: FUTOSHIKI_SIZES,
  maxDigit: (n) => n,
  xPerLine: 0,
  codeHint: "F6-…",
  rules: `
    <p>Every row and column holds the digits <b>1 to n</b> once each (1 to 6 on a 6×6 board).</p>
    <p>The signs between cells must hold: the point of a sign faces the smaller digit, so in 3 ‹ 5 the left cell is smaller, and a ∧ between two cells means the upper one is smaller.</p>
    <p>Tap a cell, then a digit. Hold <kbd>Shift</kbd> or switch on Candidates for small notes in the middle of the cell. A sign turns red when the digits next to it break it.</p>`,
  make: (difficulty, rnd) => generateFutoshiki(FUTOSHIKI_SIZES[difficulty] ?? 6, rnd, EXTRA[difficulty] ?? 0),
  encode: encodeFutoshiki,
  decode: decodeFutoshiki,
  isCode: isFutoshikiCode,
  layout(board, p, cell) {
    const N = p.n;
    board.style.setProperty("--gap", String(GAP));
    board.style.gridTemplateColumns = `repeat(${N - 1}, 1fr ${GAP}fr) 1fr`;
    const pairs = pairsOf(N);
    const signAt = new Map<string, number>(pairs.map(([a, b], k) => [`${a}-${b}`, k]));
    const sign = (a: number, b: number, vertical: boolean) => {
      const el = document.createElement("div");
      el.className = `futo-sign ${vertical ? "v" : "h"}`;
      const k = signAt.get(`${a}-${b}`)!;
      el.dataset.k = String(k);
      if (p.signs[k]) el.innerHTML = `<svg viewBox="0 0 10 10" aria-hidden="true"><path d="${chevron(p, a, b)}"/></svg>`;
      return el;
    };
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        board.appendChild(cell(r * N + c));
        if (c < N - 1) board.appendChild(sign(r * N + c, r * N + c + 1, false));
      }
      if (r < N - 1)
        for (let c = 0; c < N; c++) {
          board.appendChild(sign(r * N + c, (r + 1) * N + c, true));
          if (c < N - 1) board.appendChild(Object.assign(document.createElement("div"), { className: "futo-gap" }));
        }
    }
  },
  decorate(board, p, cells) {
    const pairs = pairsOf(p.n);
    board.querySelectorAll<HTMLElement>(".futo-sign").forEach((el) => {
      const k = Number(el.dataset.k);
      if (!p.signs[k]) return;
      const [a, b] = pairs[k];
      const va = cells[a];
      const vb = cells[b];
      const want = p.solution[a] < p.solution[b];
      el.classList.toggle("bad", va > 0 && vb > 0 && va < vb !== want);
    });
  },
  svg: futoshikiSvg,
};
