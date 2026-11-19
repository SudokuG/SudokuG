// The Techniques tab: the list, the rules, and each technique's worked example.

import { RING } from "../logic";
import type { LiteStep } from "../logic";
import { pillHtml, rulesHtml } from "./markup";
import type { LiteCtx } from "./ctx";
import type { LitePuzzle, LiteTechnique } from "./types";

export function guidePart<P extends LitePuzzle>(ctx: LiteCtx<P>) {
  const { g, root, el, S, noCands, show } = ctx;

  function buildGuideList(): void {
    const names = ["Rules", ...g.techniques.map((t) => t.name)];
    el("guide-list").replaceChildren(
      ...names.map((name) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "guide-item";
        b.dataset.name = name;
        b.setAttribute("role", "tab");
        b.textContent = name;
        b.addEventListener("click", () => showGuide(name));
        return b;
      }),
    );
  }

  /** Show an entry of the Techniques tab: the rules, or a technique with its worked example. */
  function showGuide(name: string): void {
    S.guide = name;
    root.querySelectorAll<HTMLButtonElement>("[data-r=guide-list] button").forEach((b) => {
      b.classList.toggle("on", b.dataset.name === name);
      b.setAttribute("aria-selected", String(b.dataset.name === name));
    });
    el("guide-title").textContent = name === "Rules" ? `How to play ${g.title}` : name;
    const t = g.techniques.find((x) => x.name === name);
    el("guide-rules").hidden = !!t;
    el("guide-example").hidden = !t;
    if (!t) {
      el("guide-rules").innerHTML = rulesHtml(g);
      return;
    }
    el("guide-idea").textContent = t.idea;
    el("guide-why").textContent = t.why ?? "";
    el("guide-why").hidden = el("guide-why-h").hidden = !t.why;
    el("guide-spot").textContent = t.spot;
    const ex = g.examples[name];
    const shown = ex && drawExample(t, ex);
    el("guide-step").textContent = shown || "No example for this one yet.";
  }

  /** Replay the example's solve to its step and draw the position with the step marked. */
  function drawExample(t: LiteTechnique, ex: { code: string; step: number }): string {
    let p: P;
    try {
      p = g.decode(ex.code);
    } catch {
      return "";
    }
    const solver = g.solver(p);
    const s = solver.start();
    for (let k = 0; k < ex.step; k++) {
      const st = solver.next(s);
      if (!st) return "";
      solver.apply(s, st);
    }
    const step: LiteStep | null = solver.next(s);
    if (!step || step.technique !== t.name) return "";
    const N = p.n;
    const max = g.maxDigit(N);
    const digits = ((1 << (max + 1)) - 1) & ~1;
    const values = s.dom.map((d: number, i: number) => (s.placed[i] ? 31 - Math.clz32(d) : -1));
    const region = new Set(step.region);
    const placed = new Map(step.placements.map((x) => [x.cell, x.value]));
    const gone = new Map<number, number>();
    for (const e of step.eliminations) gone.set(e.cell, (gone.get(e.cell) ?? 0) | (1 << e.value));
    const gb = el("guide-board");
    gb.replaceChildren();
    gb.style.setProperty("--n", String(N));
    const cells: HTMLElement[] = [];
    g.layout(gb, p, (i) => {
      const c = document.createElement("div");
      c.className = "lite-cell";
      cells[i] = c;
      return c;
    });
    cells.forEach((c, i) => {
      c.classList.toggle("given", p.givens[i]);
      c.classList.toggle("region", region.has(i));
      const v = values[i];
      if (placed.has(i)) {
        const pv = placed.get(i)!;
        c.classList.add("target");
        c.innerHTML = show(pv);
        if (!pv) c.classList.add("x");
      } else if (v > 0) c.innerHTML = show(v);
      else if (v === 0) {
        c.innerHTML = show(0);
        c.classList.add("x");
      } else if (t.candidates && region.has(i)) {
        // What is still possible, with what the step rules out struck through.
        const dom = s.dom[i] & (digits | (g.xPerLine ? 1 : 0));
        c.innerHTML = pillHtml(dom, max, gone.get(i) ?? 0);
        if (gone.has(i)) c.classList.add("elim");
      } else if (g.xPerLine && !noCands) {
        // On paper: a ring where it's known there's no X; the step's new rings in green.
        if (gone.has(i) && gone.get(i)! & 1) {
          c.innerHTML = pillHtml(RING, max);
          c.classList.add("target");
        } else if (!(s.dom[i] & 1)) c.innerHTML = pillHtml(RING, max);
      }
    });
    g.decorate(gb, p, values, -1);
    return step.explanation;
  }

  return { buildGuideList, showGuide };
}
