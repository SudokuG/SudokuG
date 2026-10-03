// The Techniques tab: a list of all techniques on the right, and on the left an
// example board with the move highlighted and explained.

import { bit } from "../engine";
import { GUIDE } from "../guide";
import { exampleStep } from "../guide-step";
import { BoardView, stepDecor } from "./board";

let board: BoardView | null = null;
let current = GUIDE[0].name;
const $ = (id: string) => document.getElementById(id)!;

export function initGuide(): void {
  const list = $("guide-list");
  let group = "";
  for (const entry of GUIDE) {
    if (entry.group !== group) {
      group = entry.group;
      const h = document.createElement("div");
      h.className = "guide-group";
      h.textContent = group;
      list.appendChild(h);
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "guide-item";
    b.dataset.name = entry.name;
    b.setAttribute("role", "tab");
    b.textContent = entry.name;
    b.addEventListener("click", () => {
      showGuide(entry.name);
      // On a phone the example sits above the list: bring it into view.
      if (window.matchMedia("(max-width: 760px)").matches) $("guide-view").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    list.appendChild(b);
  }
}

/** Move through the list with the arrow keys. */
export function moveGuide(delta: number): void {
  const i = GUIDE.findIndex((g) => g.name === current);
  const next = GUIDE[Math.min(GUIDE.length - 1, Math.max(0, i + delta))];
  showGuide(next.name);
  document.querySelector<HTMLElement>(`.guide-item[data-name="${CSS.escape(next.name)}"]`)?.focus({ preventScroll: false });
}

export function showGuide(name = current): void {
  current = name;
  if (!board) board = new BoardView($("guide-board"));
  const entry = GUIDE.find((g) => g.name === name)!;

  document.querySelectorAll<HTMLButtonElement>(".guide-item").forEach((b) => {
    const on = b.dataset.name === name;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", String(on));
  });

  $("guide-title").textContent = entry.name;
  $("guide-badges").innerHTML = `<span class="badge diff-${entry.group.toLowerCase()}">${entry.group}</span>`;
  $("guide-idea").textContent = entry.idea;
  $("guide-spot").textContent = entry.spot;

  const ex = exampleStep(name);
  const chain = $("guide-chain");
  if (!ex) {
    $("guide-example").textContent = "No example available.";
    chain.hidden = true;
    return;
  }
  const { grid, step } = ex;
  $("guide-example").textContent = step.explanation;
  chain.hidden = !step.notation;
  chain.textContent = step.notation ?? "";

  const decor = stepDecor(step, true);
  board.drawLinks(step);
  for (let i = 0; i < 81; i++) {
    const el = board.cells[i];
    const v = grid.values[i];
    el.className = el.className.replace(/\b(region|pattern|target|given)\b/g, "").trim();
    el.classList.toggle("given", !!v);
    el.classList.toggle("region", decor.region.has(i));
    el.classList.toggle("pattern", decor.pattern.has(i));
    el.classList.toggle("target", decor.target.has(i));
    board.vals[i].textContent = v ? String(v) : "";
    for (let d = 1; d <= 9; d++) {
      const s = board.cands[i][d - 1];
      const on = !v && !!(grid.cands[i] & bit(d));
      s.textContent = on ? String(d) : "";
      s.className = on ? decor.candClass.get(i * 10 + d) ?? "" : "";
    }
  }
}
