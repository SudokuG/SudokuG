// Star Battle: the board (cells with thick region borders), stars and dots, clashes,
// printing. The logic is in engine.ts and logic.ts; the page is ../lite.ts.

import type { LiteGame } from "../lite";
import { STAR_SIZES, around, decodeStars, encodeStars, isStarCode, starsFor } from "./engine";
import type { StarPuzzle } from "./engine";
import { STAR_EXAMPLES } from "./examples";
import { STAR_LEVELS, applyStep, makeStars, nextStep, place, rateStars, startState } from "./logic";
import type { StarLevel } from "./logic";
import { STAR_TECHNIQUES } from "./techniques";

/** A five-pointed star centred at (cx, cy) with outer radius r, as an SVG path. */
export function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.42 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

const STAR_SVG = `<svg class="sb-star" viewBox="0 0 24 24" aria-hidden="true"><path d="${starPath(12, 12.6, 11.4)}"/></svg>`;
const DOT_HTML = `<span class="sb-dot" aria-hidden="true"></span>`;

/** Which sides of cell i border another region (or the edge): top, right, bottom, left. */
function edges(p: StarPuzzle, i: number): [boolean, boolean, boolean, boolean] {
  const { n, regionOf } = p;
  const r = Math.floor(i / n);
  const c = i % n;
  const g = regionOf[i];
  return [r === 0 || regionOf[i - n] !== g, c === n - 1 || regionOf[i + 1] !== g, r === n - 1 || regionOf[i + n] !== g, c === 0 || regionOf[i - 1] !== g];
}

/** Stars that break a rule (too many in a unit, touching), and dots that leave a unit without room. */
function clashes(p: StarPuzzle, cells: number[]): Set<number> {
  const { n, k } = p;
  const out = new Set<number>();
  const units = [
    ...Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => r * n + c)),
    ...Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => r * n + c)),
    ...p.regions,
  ];
  for (const u of units) {
    const stars = u.filter((i) => cells[i] === 1);
    if (stars.length > k) stars.forEach((i) => out.add(i));
    const dots = u.filter((i) => cells[i] === 0);
    if (dots.length > u.length - k) dots.forEach((i) => out.add(i));
  }
  cells.forEach((v, i) => v === 1 && around(n, i).forEach((j) => cells[j] === 1 && (out.add(i), out.add(j))));
  return out;
}

export function starSvg(p: StarPuzzle, entries?: number[]): string {
  const N = p.n;
  const C = 100;
  const W = N * C;
  const thin: string[] = [];
  const thick: string[] = [];
  const marks: string[] = [];
  for (let i = 0; i < N * N; i++) {
    const x = (i % N) * C;
    const y = Math.floor(i / N) * C;
    const [t, r, b, l] = edges(p, i);
    (t ? thick : thin).push(`M${x} ${y}H${x + C}`);
    (l ? thick : thin).push(`M${x} ${y}V${y + C}`);
    if (r) thick.push(`M${x + C} ${y}V${y + C}`);
    if (b) thick.push(`M${x} ${y + C}H${x + C}`);
    const v = entries ? entries[i] : -1;
    if (v === 1) marks.push(`<path d="${starPath(x + 50, y + 52, 36)}" fill="#1f4f9e"/>`);
    else if (v === 0) marks.push(`<circle cx="${x + 50}" cy="${y + 50}" r="7" fill="#5b6470"/>`);
  }
  const pad = 4;
  return `<svg class="pz-grid" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${W + 2 * pad}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Star Battle puzzle"><rect x="${-pad}" y="${-pad}" width="${W + 2 * pad}" height="${W + 2 * pad}" fill="#fff"/><path d="${thin.join("")}" stroke="#9aa3ad" stroke-width="2" fill="none"/><path d="${thick.join("")}" stroke="#111" stroke-width="6" stroke-linecap="square" fill="none"/>${marks.join("")}</svg>`;
}

const starsText = (n: number) => (starsFor(n) === 1 ? "★" : "★★");

export const STAR_BATTLE: LiteGame<StarPuzzle> = {
  id: "starbattle",
  title: "Star Battle",
  noun: "puzzle",
  sizes: [...STAR_SIZES],
  defaultSize: 8,
  levels: STAR_LEVELS,
  maxDigit: () => 1,
  xPerLine: 1,
  codeHint: "B8-…",
  rules: `
    <p>Place stars in the grid: <b>one</b> in every row, every column and every region (the areas inside the thick lines). On the 10×10 board it is <b>two</b> of each.</p>
    <p>Stars never touch, not even diagonally.</p>
    <p>Mark the cells you know are empty with a dot. That is most of the work: each star you find empties the cells around it and the rest of its row, column and region.</p>`,
  controls: `<li>Tap or click a cell, then the star or dot key. Keys: <kbd>1</kbd> or <kbd>*</kbd> a star, <kbd>0</kbd>, <kbd>X</kbd> or <kbd>.</kbd> a dot (an empty cell). Right-click puts in a dot. Pressing the same key again clears the cell.</li>
      <li>Drag over cells to select them all, then press the dot to empty a whole stretch at once. On a phone, hold <b>S</b> to add more cells; on a computer, <kbd>Shift</kbd> adds cells and <kbd>Ctrl</kbd> toggles them.</li>
      <li><kbd>H</kbd> hint, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Backspace</kbd> erase, arrow keys move. Stars that break a rule, and dots that leave a row, column or region without room, turn red.</li>`,
  candidates: false,
  glyph: (v) => (v ? STAR_SVG : DOT_HTML),
  valueName: (v) => (v ? "Star" : "Empty"),
  keyAliases: { "*": 1, ".": 0, o: 0, O: 0 },
  clashes,
  sizeLabel: (n) => `${n}×${n} ${starsText(n)}`,
  make: (n, level, rnd) => makeStars(n, level as StarLevel, rnd),
  levelOf: (p) => rateStars(p)?.level ?? "Unrated",
  encode: encodeStars,
  decode: decodeStars,
  isCode: isStarCode,
  layout(board, p, cell) {
    board.style.gridTemplateColumns = `repeat(${p.n}, 1fr)`;
    for (let i = 0; i < p.n * p.n; i++) {
      const wrap = document.createElement("div");
      // Each cell draws its top and left line (thick at a region edge); the last column and
      // row also draw the outer edge, so no line is drawn twice.
      const [t, , , l] = edges(p, i);
      const lastCol = i % p.n === p.n - 1;
      const lastRow = i >= p.n * (p.n - 1);
      wrap.className = `sb-wrap${t ? " bt" : ""}${l ? " bl" : ""}${lastCol ? " br" : ""}${lastRow ? " bb" : ""}`;
      wrap.appendChild(cell(i));
      board.appendChild(wrap);
    }
  },
  decorate() {},
  svg: (p, entries) => starSvg(p, entries),
  solver: (p) => ({
    start: () => startState(p),
    place: (s, i, v) => place(p, s, i, v),
    next: (s) => nextStep(p, s),
    apply: (s, st) => applyStep(p, s, st),
  }),
  techniques: STAR_TECHNIQUES,
  examples: STAR_EXAMPLES,
  hintToPlacement: false,
};
