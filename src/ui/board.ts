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
    this.overlay = document.createElementNS(SVG_NS, "svg");
    this.overlay.setAttribute("class", "overlay");
    this.overlay.setAttribute("viewBox", "0 0 900 900");
    this.overlay.setAttribute("preserveAspectRatio", "none");
    this.overlay.setAttribute("aria-hidden", "true");
    el.appendChild(this.overlay);
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

/** CSS background for a cell painted with one or more of the 9 colours (bitmask). */
export function paintBackground(mask: number): string {
  const ds = digitsOf(mask);
  if (!ds.length) return "";
  if (ds.length === 1) return `var(--c${ds[0]})`;
  const step = 360 / ds.length;
  return `conic-gradient(from 45deg, ${ds.map((d, k) => `var(--c${d}) ${k * step}deg ${(k + 1) * step}deg`).join(", ")})`;
}
