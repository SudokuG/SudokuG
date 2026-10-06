// A 9×9 board made of DOM elements, shared by the playing grid and the technique
// examples. It only builds and holds the elements; app.ts and guide-view.ts decide
// what goes in them.

import { UNITS, colOf, digitsOf, rowOf } from "../engine";
import type { Step } from "../engine";

const SVG_NS = "http://www.w3.org/2000/svg";

export class BoardView {
  cells: HTMLDivElement[] = [];
  vals: HTMLSpanElement[] = [];
  cands: HTMLSpanElement[][] = [];
  centre: HTMLSpanElement[] = [];
  paint: HTMLDivElement[] = [];
  overlay: SVGSVGElement;
  /** Outline around the selected cells (below the chain lines). */
  selOverlay: SVGSVGElement;
  private selPath: SVGPathElement;

  constructor(public el: HTMLElement) {
    for (let i = 0; i < 81; i++) {
      const r = rowOf(i);
      const c = colOf(i);
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.i = String(i);
      if (c % 3 === 2) cell.classList.add("bx");
      if (r % 3 === 2) cell.classList.add("by");
      if (c === 8) cell.classList.add("c8");
      if (r === 8) cell.classList.add("r8");
      cell.setAttribute("role", "gridcell");

      const paint = document.createElement("div");
      paint.className = "paint";
      const val = document.createElement("span");
      val.className = "val";
      const cands = document.createElement("div");
      cands.className = "cands";
      const spans: HTMLSpanElement[] = [];
      for (let d = 1; d <= 9; d++) {
        const s = document.createElement("span");
        cands.appendChild(s);
        spans.push(s);
      }
      const centre = document.createElement("span");
      centre.className = "centre";
      cell.append(paint, val, cands, centre);
      el.appendChild(cell);
      this.cells.push(cell);
      this.vals.push(val);
      this.cands.push(spans);
      this.centre.push(centre);
      this.paint.push(paint);
    }
    this.selOverlay = document.createElementNS(SVG_NS, "svg");
    this.selOverlay.setAttribute("class", "overlay sel-overlay");
    this.selOverlay.setAttribute("viewBox", "0 0 900 900");
    this.selOverlay.setAttribute("preserveAspectRatio", "none");
    this.selOverlay.setAttribute("aria-hidden", "true");
    this.selPath = document.createElementNS(SVG_NS, "path");
    this.selOverlay.appendChild(this.selPath);
    el.appendChild(this.selOverlay);
    this.overlay = document.createElementNS(SVG_NS, "svg");
    this.overlay.setAttribute("class", "overlay");
    this.overlay.setAttribute("viewBox", "0 0 900 900");
    this.overlay.setAttribute("preserveAspectRatio", "none");
    this.overlay.setAttribute("aria-hidden", "true");
    el.appendChild(this.overlay);
  }

  /**
   * One outline around each group of selected cells, drawn just inside its outer edge.
   * Each edge of a selected cell that borders an unselected cell (or the board edge)
   * becomes a line; its ends are moved in at outer corners and out at inner corners so
   * the lines join up.
   */
  drawSelection(sel: Set<number>): void {
    const on = (r: number, c: number) => r >= 0 && r < 9 && c >= 0 && c < 9 && sel.has(r * 9 + c);
    const d = 4; // inset of the line's centre, in board units (a cell is 100)
    // End offset along an edge: inward at an outer corner, outward at an inner corner.
    const end = (side: boolean, diag: boolean) => (!side ? d : diag ? -d : 0);
    const parts: string[] = [];
    for (const i of sel) {
      const r = rowOf(i);
      const c = colOf(i);
      const x0 = c * 100;
      const y0 = r * 100;
      if (!on(r - 1, c)) parts.push(`M${x0 + end(on(r, c - 1), on(r - 1, c - 1))} ${y0 + d}H${x0 + 100 - end(on(r, c + 1), on(r - 1, c + 1))}`);
      if (!on(r + 1, c)) parts.push(`M${x0 + end(on(r, c - 1), on(r + 1, c - 1))} ${y0 + 100 - d}H${x0 + 100 - end(on(r, c + 1), on(r + 1, c + 1))}`);
      if (!on(r, c - 1)) parts.push(`M${x0 + d} ${y0 + end(on(r - 1, c), on(r - 1, c - 1))}V${y0 + 100 - end(on(r + 1, c), on(r + 1, c - 1))}`);
      if (!on(r, c + 1)) parts.push(`M${x0 + 100 - d} ${y0 + end(on(r - 1, c), on(r - 1, c + 1))}V${y0 + 100 - end(on(r + 1, c), on(r + 1, c + 1))}`);
    }
    this.selPath.setAttribute("d", parts.join(""));
  }

  /** Draw the chain or coloring links of a step (or clear them). */
  drawLinks(step: Step | null): void {
    this.overlay.replaceChildren();
    if (!step?.links) return;
    for (const l of step.links) {
      const [x1, y1] = candPoint(l.from.cell, l.from.digit);
      const [x2, y2] = candPoint(l.to.cell, l.to.digit);
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const k = Math.min(11, len / 3) / len; // stop short of the digits
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(x1 + (x2 - x1) * k));
      line.setAttribute("y1", String(y1 + (y2 - y1) * k));
      line.setAttribute("x2", String(x2 - (x2 - x1) * k));
      line.setAttribute("y2", String(y2 - (y2 - y1) * k));
      if (!l.strong) line.setAttribute("class", "weak");
      this.overlay.appendChild(line);
    }
  }
}

/** Centre of a candidate in overlay coordinates (each cell is 100×100). */
function candPoint(cell: number, d: number): [number, number] {
  const sub = 92 / 3;
  return [colOf(cell) * 100 + 4 + (((d - 1) % 3) + 0.5) * sub, rowOf(cell) * 100 + 4 + (Math.floor((d - 1) / 3) + 0.5) * sub];
}

export interface StepDecor {
  region: Set<number>;
  pattern: Set<number>;
  target: Set<number>;
  /** CSS class per candidate, keyed cell*10+digit. */
  candClass: Map<number, string>;
}

/** Which cells and candidates to highlight for a step. `full` reveals the whole move. */
export function stepDecor(step: Step | null, full: boolean): StepDecor {
  const d: StepDecor = { region: new Set(), pattern: new Set(), target: new Set(), candClass: new Map() };
  if (!step) return d;
  for (const u of step.units) for (const c of UNITS[u].cells) d.region.add(c);
  if (!full) return d;
  step.cells.forEach((c) => d.pattern.add(c));
  step.candidates.forEach((x) => d.candClass.set(x.cell * 10 + x.digit, "pat"));
  step.colors?.forEach((x) => d.candClass.set(x.cell * 10 + x.digit, x.color === 0 ? "ca" : "cb"));
  step.eliminations.forEach((x) => d.candClass.set(x.cell * 10 + x.digit, "elim"));
  step.placements.forEach((x) => {
    d.target.add(x.cell);
    d.candClass.set(x.cell * 10 + x.digit, "put");
  });
  return d;
}

/** Number of colour palettes; colour d of palette p is bit p*9 + d-1 of a cell's mask. */
export const PALETTES = 3;
export const paletteBit = (p: number, d: number) => 1 << (p * 9 + d - 1);
/** The colours (1-9) of palette p in a cell's mask. */
export const paletteDigits = (mask: number, p: number) => digitsOf((mask >> (p * 9)) & 511);

/**
 * How the palettes look: the first one fills the cell, the second paints stripes leaning
 * right (/), the third stripes leaning left (\). The same nine colours in each, so the
 * pattern tells the palettes apart and a colour keeps its number in all three.
 */
const STRIPE_ANGLE = [0, 45, -45];

/** Stripes of the given colours, with gaps; `band` and `gap` are CSS lengths. */
export function stripes(p: number, ds: number[], band: string, gap: string): string {
  const stops: string[] = [];
  ds.forEach((d, k) => {
    const at = (n: number) => `calc(${band} * ${n} + ${gap} * ${n})`;
    stops.push(`var(--c${d}) ${at(k)} calc(${at(k)} + ${band})`, `transparent calc(${at(k)} + ${band}) ${at(k + 1)}`);
  });
  return `repeating-linear-gradient(${STRIPE_ANGLE[p]}deg, ${stops.join(", ")})`;
}

/** Background layer of one palette in a cell, or "" if it has none of its colours. */
function paletteLayer(p: number, ds: number[]): string {
  if (!ds.length) return "";
  if (p > 0) return stripes(p, ds, "1.5cqi", "1.3cqi");
  if (ds.length === 1) return `linear-gradient(var(--c${ds[0]}), var(--c${ds[0]}))`;
  const step = 360 / ds.length;
  return `conic-gradient(from 45deg, ${ds.map((d, k) => `var(--c${d}) ${k * step}deg ${(k + 1) * step}deg`).join(", ")})`;
}

/** CSS background for a cell's colours (all palettes), leaving out hidden palettes. */
export function paintBackground(mask: number, hidden: boolean[] = []): string {
  const layers: string[] = [];
  // Last palette on top: stripes over the solid fill.
  for (let p = PALETTES - 1; p >= 0; p--) {
    if (hidden[p]) continue;
    const layer = paletteLayer(p, paletteDigits(mask, p));
    if (layer) layers.push(layer);
  }
  return layers.join(", ");
}
