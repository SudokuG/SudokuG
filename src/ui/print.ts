// Printing: puzzles laid out on paper pages, printed (or saved as PDF) with the browser's
// own print dialog. The pages are built in #print-root, which only shows when printing
// (see the @media print rules in style.css); everything else on the page is hidden then.
//
// Printouts always use light colours, whatever the theme: black lines and digits on white,
// so dark mode never empties an ink cartridge. Each puzzle is an SVG, which prints crisply
// at any size and keeps cell colours even when the browser leaves out backgrounds.

import { colOf, digitsOf, rowOf } from "../engine";

export interface PrintPuzzle {
  /** Other puzzle types: their own drawing (an <svg class="pz-grid">), used instead of a sudoku. */
  svg?: string;
  /** Sudoku: the starting digits (81, 0 = empty). */
  givens: number[];
  /** With progress: the digits filled in so far (givens included). */
  values?: number[];
  /** With progress: candidate masks to show per cell. */
  cands?: number[];
  /** With progress: "pairs" written in the centre of a cell (masks). */
  centre?: number[];
  /** With progress: cell colours (27-bit masks, see paletteBit in board.ts). */
  colors?: number[];
  name?: string;
  difficulty?: string;
  code?: string;
}

export type PerPage = 1 | 2 | 4 | 6;
export const PER_PAGE: PerPage[] = [1, 2, 4, 6];

export interface PrintLayout {
  perPage: PerPage;
  name: boolean;
  difficulty: boolean;
  code: boolean;
}

/** The nine cell colours, as in the light theme. */
const COLORS = ["#b7bcc2", "#f4978e", "#f8b878", "#f6dc6e", "#9bd8a5", "#84d4cf", "#93b8f5", "#c4a7f0", "#f3a6c8"];
const FONT = `"Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif`;

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

let svgCount = 0;

/** One puzzle as SVG markup (a 900×900 board, each cell 100×100). */
export function puzzleSvg(p: PrintPuzzle): string {
  const id = `pz${++svgCount}`;
  const defs = new Map<string, string>();
  const parts: string[] = [`<rect width="900" height="900" fill="#fff"/>`];

  // Cell colours: the first palette fills the cell (split in strips for several colours),
  // the other two are stripes leaning right and left, as on screen.
  if (p.colors)
    for (let i = 0; i < 81; i++) {
      const m = p.colors[i];
      if (!m) continue;
      const x = colOf(i) * 100;
      const y = rowOf(i) * 100;
      const solid = digitsOf(m & 511);
      solid.forEach((d, k) => parts.push(`<rect x="${x + (k * 100) / solid.length}" y="${y}" width="${100 / solid.length}" height="100" fill="${COLORS[d - 1]}" fill-opacity="0.6"/>`));
      for (const pal of [1, 2]) {
        const ds = digitsOf((m >> (pal * 9)) & 511);
        if (!ds.length) continue;
        const key = `${id}-s${pal}-${ds.join("")}`;
        if (!defs.has(key)) {
          const w = 13 * ds.length;
          const stripes = ds.map((d, k) => `<rect x="${k * 13}" width="7" height="${w}" fill="${COLORS[d - 1]}"/>`).join("");
          defs.set(key, `<pattern id="${key}" width="${w}" height="${w}" patternUnits="userSpaceOnUse" patternTransform="rotate(${pal === 1 ? 45 : -45})">${stripes}</pattern>`);
        }
        parts.push(`<rect x="${x}" y="${y}" width="100" height="100" fill="url(#${key})" fill-opacity="0.85"/>`);
      }
    }

  // Grid lines: thin between cells, bold around the boxes and the edge.
  const thin: string[] = [];
  const bold: string[] = [];
  for (let k = 1; k < 9; k++) (k % 3 ? thin : bold).push(`M${k * 100} 0V900M0 ${k * 100}H900`);
  parts.push(`<path d="${thin.join("")}" stroke="#9aa3ad" stroke-width="2.5" fill="none"/>`);
  parts.push(`<path d="${bold.join("")}" stroke="#111" stroke-width="6" fill="none"/>`);
  parts.push(`<rect x="3.5" y="3.5" width="893" height="893" stroke="#111" stroke-width="7" fill="none"/>`);

  // Digits, candidates and pairs.
  const text: string[] = [];
  for (let i = 0; i < 81; i++) {
    const cx = colOf(i) * 100 + 50;
    const cy = rowOf(i) * 100 + 50;
    const given = p.givens[i];
    const v = given || p.values?.[i] || 0;
    if (v) {
      text.push(
        given
          ? `<text x="${cx}" y="${cy + 23}" font-size="66" font-weight="700" fill="#000">${v}</text>`
          : `<text x="${cx}" y="${cy + 23}" font-size="62" fill="#1f4f9e">${v}</text>`,
      );
      continue;
    }
    const centre = p.centre?.[i] ? digitsOf(p.centre[i]) : [];
    if (centre.length) {
      const size = centre.length > 4 ? 22 : centre.length > 3 ? 26 : 32;
      text.push(`<text x="${cx}" y="${cy + size * 0.36}" font-size="${size}" fill="#222">${centre.join("")}</text>`);
      continue;
    }
    const cands = p.cands?.[i] ? digitsOf(p.cands[i]) : [];
    for (const d of cands) {
      const sub = 92 / 3;
      const x = colOf(i) * 100 + 4 + (((d - 1) % 3) + 0.5) * sub;
      const y = rowOf(i) * 100 + 4 + (Math.floor((d - 1) / 3) + 0.5) * sub;
      text.push(`<text x="${x.toFixed(1)}" y="${(y + 8.5).toFixed(1)}" font-size="24" fill="#4a4f55">${d}</text>`);
    }
  }
  parts.push(`<g text-anchor="middle" font-family='${FONT}'>${text.join("")}</g>`);

  const defsMarkup = defs.size ? `<defs>${[...defs.values()].join("")}</defs>` : "";
  return `<svg class="pz-grid" viewBox="0 0 900 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sudoku puzzle">${defsMarkup}${parts.join("")}</svg>`;
}

/** Fill `root` with pages of puzzles. */
export function renderPrint(root: HTMLElement, puzzles: PrintPuzzle[], layout: PrintLayout): void {
  const pages: string[] = [];
  for (let k = 0; k < puzzles.length; k += layout.perPage) {
    const figs = puzzles.slice(k, k + layout.perPage).map((p) => {
      const meta = [layout.difficulty && p.difficulty, layout.code && p.code].filter(Boolean).map((t) => esc(String(t)));
      const caption =
        (layout.name && p.name) || meta.length
          ? `<figcaption>${layout.name && p.name ? `<span class="pz-name">${esc(p.name)}</span>` : ""}${meta.length ? `<span class="pz-meta">${meta.join(" · ")}</span>` : ""}</figcaption>`
          : "";
      return `<figure class="pz">${caption}${p.svg ?? puzzleSvg(p)}</figure>`;
    });
    pages.push(`<section class="pp pp-${layout.perPage}">${figs.join("")}</section>`);
  }
  root.innerHTML = pages.join("");
}
