// Star Battle: the board (cells with thick region borders and a soft colour per region),
// stars and crosses, clashes, printing. The logic is in engine.ts and logic.ts; the page is ../lite.ts.

import type { LiteGame } from "../lite";
import { STAR_SIZES, around, decodeStars, encodeStars, isStarCode, starsFor } from "./engine";
import type { StarPuzzle } from "./engine";
import { STAR_EXAMPLES } from "./examples";
import { STAR_LEVELS, applyStep, makeStars, nextStep, place, rateStars, startState } from "./logic";
import type { StarLevel } from "./logic";
import { STAR_TECHNIQUES } from "./techniques";

/** A five-pointed star centred at (cx, cy) with outer radius r, as an SVG path. */
export function starPath(cx: number, cy: number, r: number, inner = 0.42): string {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * inner : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

// A star with rounded tips (a round-joined stroke around a slightly smaller star) and a soft
// highlight on its upper half; a cross with round ends.
const STAR_SVG = `<svg class="sb-star" viewBox="0 0 24 24" aria-hidden="true"><path class="body" d="${starPath(12, 12.9, 9.6, 0.47)}"/><path class="shine" d="${starPath(12, 11.6, 5.2, 0.47)}"/></svg>`;
const CROSS_SVG = `<svg class="sb-cross" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7L17 17M17 7L7 17"/></svg>`;

/** Blue, rose, green, peach, violet, teal, pink, sand, periwinkle, coral, mint, purple. */
const HUES = [205, 350, 135, 30, 275, 178, 318, 48, 238, 12, 158, 295];

/**
 * A hue per region, all different, neighbours as far apart on the colour wheel as possible
 * (regions coloured one by one, each taking the free hue furthest from its neighbours').
 */
export function regionHues(p: StarPuzzle): number[] {
  const { n, regions, regionOf } = p;
  const near: Set<number>[] = regions.map(() => new Set());
  for (let i = 0; i < n * n; i++)
    for (const j of [i % n < n - 1 ? i + 1 : -1, i + n < n * n ? i + n : -1])
      if (j >= 0 && regionOf[i] !== regionOf[j]) (near[regionOf[i]].add(regionOf[j]), near[regionOf[j]].add(regionOf[i]));
  // Hand-picked hues that stay easy to tell apart as soft pastels (no olive, which looks
  // muddy when dark); a board uses the first n.
  const free = HUES.slice(0, regions.length);
  const hue = new Array<number>(regions.length).fill(-1);
  const order = regions.map((_, g) => g).sort((a, b) => near[b].size - near[a].size);
  const dist = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  for (const g of order) {
    const taken = [...near[g]].map((x) => hue[x]).filter((h) => h >= 0);
    let best = 0;
    let score = -1;
    free.forEach((h, k) => {
      const d = taken.length ? Math.min(...taken.map((t) => dist(h, t))) : 180;
      if (d > score) (score = d), (best = k);
    });
    hue[g] = free.splice(best, 1)[0];
  }
  return hue;
}

/** Which sides of cell i border another region (or the edge): top, right, bottom, left. */
function edges(p: StarPuzzle, i: number): [boolean, boolean, boolean, boolean] {
  const { n, regionOf } = p;
  const r = Math.floor(i / n);
  const c = i % n;
  const g = regionOf[i];
  return [r === 0 || regionOf[i - n] !== g, c === n - 1 || regionOf[i + 1] !== g, r === n - 1 || regionOf[i + n] !== g, c === 0 || regionOf[i - 1] !== g];
}

/** Stars that break a rule (too many in a unit, touching), and crosses that leave a unit without room. */
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

/** Cells that must be empty given the stars entered: around each star, and the rest of full units. */
function autoMarks(p: StarPuzzle, cells: number[]): Set<number> {
  const { n, k } = p;
  const out = new Set<number>();
  cells.forEach((v, i) => v === 1 && around(n, i).forEach((j) => out.add(j)));
  const units = [
    ...Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => r * n + c)),
    ...Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => r * n + c)),
    ...p.regions,
  ];
  for (const u of units) if (u.filter((i) => cells[i] === 1).length >= k) u.forEach((i) => cells[i] !== 1 && out.add(i));
  return out;
}

/** Solved when exactly the right cells hold stars (the rest needn't be crossed). */
const isSolved = (p: StarPuzzle, cells: number[]) => p.solution.every((v, i) => (v === 1) === (cells[i] === 1));

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
    if (v === 1) marks.push(`<path d="${starPath(x + 50, y + 53, 31, 0.47)}" fill="#1f4f9e" stroke="#1f4f9e" stroke-width="9" stroke-linejoin="round"/>`);
    else if (v === 0) marks.push(`<path d="M${x + 33} ${y + 33}L${x + 67} ${y + 67}M${x + 67} ${y + 33}L${x + 33} ${y + 67}" stroke="#5b6470" stroke-width="6" stroke-linecap="round"/>`);
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
    <p>Cross out the cells you know are empty. That is most of the work: each star you find empties the cells around it and the rest of its row, column and region.</p>`,
  controls: `<li><b>Smart input</b> (Options, on by default): tap or click a cell to cross it, or drag over cells to cross them all (stars stay). Double-tap or double-click for a star (again to take it away). Hold a cell, or right-click it, to clear it; right-drag clears every cell you pass.</li>
      <li>To work on several cells at once, hold <b>S</b> (phone) or <kbd>Shift</kbd> (computer) while you tap or drag: that selects them. Then the star or cross key fills them, and holding or right-clicking inside the selection clears them. Tap outside the grid to drop the selection.</li>
      <li>Without smart input: tap a cell (drag to select several), then the star or cross key; with the right mouse button, click or drag to cross every open cell you pass.</li>
      <li>Keys: <kbd>1</kbd> or <kbd>*</kbd> a star, <kbd>0</kbd>, <kbd>X</kbd> or <kbd>.</kbd> a cross; the same key again clears the cell. <kbd>H</kbd> hint, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Backspace</kbd> erase, arrow keys move.</li>
      <li>With “Cross automatically” (on by default), a star crosses the cells around it, and the rest of its row, column or region once that has all its stars. The puzzle is solved as soon as all the stars are right. Stars that break a rule, and crosses that leave a row, column or region without room, turn red.</li>`,
  candidates: false,
  glyph: (v) => (v ? STAR_SVG : CROSS_SVG),
  valueName: (v) => (v ? "Star" : "Cross"),
  optionDefaults: { autoFinish: 0 },
  smartInput: true,
  keyAliases: { "*": 1, ".": 0, o: 0, O: 0 },
  clashes,
  autoMarks,
  isSolved,
  sizeLabel: (n) => `${n}×${n} ${starsText(n)}`,
  make: (n, level, rnd) => makeStars(n, level as StarLevel, rnd),
  levelOf: (p) => rateStars(p)?.level ?? "Unrated",
  encode: encodeStars,
  decode: decodeStars,
  isCode: isStarCode,
  layout(board, p, cell) {
    board.style.gridTemplateColumns = `repeat(${p.n}, 1fr)`;
    const hues = regionHues(p);
    for (let i = 0; i < p.n * p.n; i++) {
      const wrap = document.createElement("div");
      wrap.style.setProperty("--rh", String(hues[p.regionOf[i]]));
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
