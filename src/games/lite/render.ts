// Drawing the board: building the cells and the SVG overlays, render(), the notes list.

import { RING } from "../logic";
import { t, tLevel } from "../../ui/i18n";
import { outlinePath } from "../../ui/board";
import { SVG_NS, fmtTime, linesHtml, pillHtml } from "./markup";
import type { LiteCtx } from "./ctx";
import type { LitePuzzle } from "./types";

export function renderPart<P extends LitePuzzle>(ctx: LiteCtx<P>) {
  const { g, root, el, all, btn, board, opt, S, noCands, show, valueName, n, maxDigit, nameOf } = ctx;

  function buildBoard(): void {
    board.replaceChildren();
    board.style.setProperty("--n", String(n()));
    ctx.cellEls = new Array(n() * n());
    g.layout(board, S.p!, (i) => {
      const cell = document.createElement("div");
      cell.className = "lite-cell";
      cell.dataset.i = String(i);
      cell.setAttribute("role", "gridcell");
      ctx.cellEls[i] = cell;
      return cell;
    });
    // Lines (thin grid, thick regions) and the selection outline, drawn over the cells.
    const svg = (cls: string) => {
      const o = document.createElementNS(SVG_NS, "svg");
      o.setAttribute("class", `lite-overlay ${cls}`);
      o.setAttribute("viewBox", `0 0 ${n() * 100} ${n() * 100}`);
      o.setAttribute("preserveAspectRatio", "none");
      o.setAttribute("aria-hidden", "true");
      board.appendChild(o);
      return o;
    };
    linesSvg = g.regions ? svg("lite-lines") : null;
    if (linesSvg) linesSvg.innerHTML = linesHtml(n(), g.regions!(S.p!));
    selSvg = g.separateCells ? null : svg("lite-sel");
    selPath = selSvg ? (selSvg.appendChild(document.createElementNS(SVG_NS, "path")) as SVGPathElement) : null;
    placeOverlays();
  }

  let linesSvg: SVGSVGElement | null = null;
  let selSvg: SVGSVGElement | null = null;
  let selPath: SVGPathElement | null = null;
  /** Put the overlays exactly over the cells (Treasure Map has clues around them). */
  function placeOverlays(): void {
    const first = ctx.cellEls[0];
    const last = ctx.cellEls[ctx.cellEls.length - 1];
    if (!first || !last) return;
    const b = board.getBoundingClientRect();
    const a = first.getBoundingClientRect();
    const z = last.getBoundingClientRect();
    for (const o of [linesSvg, selSvg]) {
      if (!o) continue;
      o.style.left = `${a.left - b.left - board.clientLeft}px`;
      o.style.top = `${a.top - b.top - board.clientTop}px`;
      o.style.width = `${z.right - a.left}px`;
      o.style.height = `${z.bottom - a.top}px`;
    }
  }
  new ResizeObserver(() => placeOverlays()).observe(board);
  function render(): void {
    if (!S.p) return;
    const N = n();
    const { cells, cands } = S.cur;
    const sr = Math.floor(S.sel / N);
    const sc = S.sel % N;
    // Repeated digits (or too many X's) in a line; or the type's own rule.
    const clash = g.clashes ? g.clashes(S.p, cells) : new Set<number>();
    if (!g.clashes)
      for (let k = 0; k < N; k++)
      for (const idx of [Array.from({ length: N }, (_, c) => k * N + c), Array.from({ length: N }, (_, r) => r * N + k)]) {
        const seen = new Map<number, number[]>();
        for (const i of idx) if (cells[i] >= 0) seen.set(cells[i], [...(seen.get(cells[i]) ?? []), i]);
        for (const [v, at] of seen) if ((v > 0 && at.length > 1) || (v === 0 && at.length > g.xPerLine)) at.forEach((i) => clash.add(i));
      }
    const h = S.hint;
    const step = h?.kind === "step" ? h.step : null;
    const full = !!step && S.hintLevel === 2;
    const region = new Set(step?.region ?? []);
    const targets = new Set(full ? step!.placements.map((x) => x.cell) : []);
    const elims = new Set(full ? step!.eliminations.map((x) => x.cell) : []);
    // The digit to highlight: a digit tapped on the pad with nothing selected, else that of
    // the first selected cell with a digit.
    const pd = S.selection.size ? 0 : S.padDigit;
    const hl = S.selOrder.find((x) => S.selection.has(x) && cells[x] > 0);
    const hlVal = pd || (hl === undefined ? 0 : cells[hl]);
    const sameOn = (opt.same || !!pd) && !noCands;
    const multi = S.selection.size > 1;
    const cursor = !S.quiet && S.selection.has(S.sel);
    const regionOf = g.regions && opt.region ? g.regions(S.p) : null;
    for (let i = 0; i < N * N; i++) {
      const c = ctx.cellEls[i];
      const v = cells[i];
      const r = Math.floor(i / N);
      const col = i % N;
      c.classList.toggle("given", S.p.givens[i]);
      c.classList.toggle("sel", S.selection.has(i) && !S.quiet);
      c.classList.toggle("primary", i === S.sel && S.selection.has(i) && !S.quiet);
      const peer = cursor && !multi && i !== S.sel && ((opt.peers && (r === sr || col === sc)) || (!!regionOf && regionOf[i] === regionOf[S.sel]));
      c.classList.toggle("peer", peer);
      c.classList.toggle("same", sameOn && hlVal > 0 && v === hlVal && i !== hl);
      // Cells with the highlighted digit among their candidates: a lighter mark, to see patterns.
      const candHl = sameOn && hlVal > 0 && v < 0 && cands[i] !== RING && !!(cands[i] & (1 << hlVal));
      c.classList.toggle("cand-same", candHl);
      c.classList.toggle("x", v === 0);
      c.classList.toggle("has-value", v > 0);
      c.classList.toggle("wrong", S.wrong.has(i));
      c.classList.toggle("clash", clash.has(i));
      const ringOnX = v < 0 && S.p.solution[i] === 0 && cands[i] && !(cands[i] & 1);
      c.classList.toggle("mistake", opt.mistakes && !S.p.givens[i] && ((v >= 0 && v !== S.p.solution[i]) || !!ringOnX));
      c.classList.toggle("region", region.has(i));
      c.classList.toggle("target", targets.has(i));
      c.classList.toggle("elim", elims.has(i));
      // Only rewrite a cell whose content changed (so a mark appearing animates once).
      const html = v >= 0 ? show(v) : pillHtml(cands[i], maxDigit(), 0, candHl ? hlVal : 0);
      if (c.dataset.h !== html) {
        const d = ctx.delays.get(i);
        if (d) c.style.setProperty("--d", `${d}ms`);
        else c.style.removeProperty("--d");
        c.innerHTML = html;
        c.dataset.h = html;
      }
      c.setAttribute("aria-label", t("Row {r}, column {c}: {what}", { r: r + 1, c: col + 1, what: v >= 0 ? valueName(v) : t(cands[i] === RING ? "a digit" : "open") }));
      c.setAttribute("aria-selected", String(S.selection.has(i)));
    }
    if (g.notes) {
      const nf = S.noteFocus;
      ctx.cellEls.forEach((c, i) => c.classList.toggle("note-region", nf !== null && g.notes!.regionOf(S.p!, i) === nf));
      renderNotes();
    }
    if (ctx.delays.size) {
      // Once the wave has passed, the delays go (so later changes to those cells are instant).
      const done = [...ctx.delays.keys()];
      const wait = Math.max(...ctx.delays.values()) + 300;
      ctx.delays.clear();
      setTimeout(() => done.forEach((i) => ctx.cellEls[i]?.style.removeProperty("--d")), wait);
    }
    root.classList.toggle("no-outline", !opt.outline);
    selPath?.setAttribute("d", opt.outline && !S.quiet ? outlinePath(S.selection, N, 4) : "");
    g.decorate(board, S.p, cells, S.selection.has(S.sel) ? S.sel : -1);
    el("name").textContent = nameOf(S.code, S.level);
    el("label").textContent = `${g.title} · ${t(S.level)} · ${N}×${N}`;
    all("code").forEach((x) => (x.textContent = S.code));
    el("timer").hidden = !opt.timer;
    btn("undo").disabled = !S.undo.length || S.solved;
    btn("redo").disabled = !S.redo.length || S.solved;
    const mode = root.querySelector<HTMLElement>('[data-r="mode"]');
    mode?.classList.toggle("on", S.pencil);
    mode?.setAttribute("aria-pressed", String(S.pencil));
    // Candidate entry (Candidates, Shift or S) turns the board and pad green, as in sudoku;
    // the S key takes the colour of the Candidates button's mode.
    root.classList.toggle("mode-pencil", ctx.pencilOn());
    const pad = el("pad");
    pad.classList.toggle("pad-pencil", ctx.pencilOn());
    pad.classList.toggle("base-pencil", S.pencil && !noCands);
    // What is left of each value (stars, digits), and keys greyed out once all are placed.
    pad.querySelectorAll<HTMLElement>("[data-v]").forEach((k) => {
      const v = Number(k.dataset.v);
      // The key of the highlighted digit is marked too, however the digit was picked.
      k.classList.toggle("hl", sameOn && hlVal > 0 && v === hlVal);
      if (v <= 0 || v === RING) return;
      const left = S.p!.solution.filter((x) => x === v).length - cells.filter((x) => x === v).length;
      k.classList.toggle("done", left <= 0);
      const tag = k.querySelector<HTMLElement>(".left");
      if (tag) tag.textContent = opt.padCounts && !ctx.pencilOn() && left > 0 ? String(left) : "";
    });
    pad.querySelector(".pad-sticky")?.classList.toggle("on", S.sticky);
    el("solved").hidden = !S.solved;
    el("solved-time").textContent = fmtTime(S.elapsed);
    const what = { level: tLevel(S.pickLevel), size: `${S.pickSize}×${S.pickSize}` };
    el("solved-new").textContent = t(`New {level} {size} ${g.noun}`, what);
    el("new").textContent = t(`New {level} {size} ${g.noun}`, what);
    el("print-many").textContent = t(`Print {level} {size} ${g.noun}s`, what);
    for (const [r, val] of [["sizes", String(S.pickSize)], ["levels", S.pickLevel]] as const)
      root.querySelectorAll<HTMLButtonElement>(`[data-r=${r}] button`).forEach((b) => {
        const on = b.dataset.v === val;
        b.classList.toggle("on", on);
        b.setAttribute("aria-checked", String(on));
      });
    // Hint card
    const card = el("hint-card");
    card.hidden = !h;
    card.classList.toggle("error", h?.kind === "error");
    if (h) {
      el("hint-tech").textContent = h.kind === "step" ? h.step.technique : t(h.kind === "error" ? "Something is off" : h.kind === "solved" ? "Solved" : "No hint available");
      el("hint-text").textContent = h.kind === "step" ? (full ? h.step.explanation : h.step.nudge) : t(h.message);
      el("hint-more").hidden = h.kind !== "step" || full;
      el("hint-apply").hidden = h.kind !== "step" || !full;
    }
  }
  // ---- Notes (types with regions, e.g. Calcudoku cages) --------------------------------
  /** Show the notes: every region with a note, plus the selected cell's region (an empty field to start one). */
  function renderNotes(): void {
    const nt = g.notes;
    const list = el("note-list");
    if (!nt || !list || !S.p) return;
    const p = S.p;
    const active = S.selection.has(S.sel) ? nt.regionOf(p, S.sel) : -1;
    const want = new Set(Object.keys(S.notes).map(Number).filter((k) => S.notes[k]));
    if (active >= 0 && !nt.skip(p, active)) want.add(active);
    if (S.noteFocus !== null) want.add(S.noteFocus);
    const order = [...want].sort((a, b) => a - b);
    const have = new Map([...list.querySelectorAll<HTMLElement>(".note")].map((x) => [Number(x.dataset.k), x]));
    for (const [k, x] of have) if (!want.has(k)) x.remove();
    let prev: HTMLElement | null = null;
    for (const k of order) {
      let x = have.get(k);
      if (!x) {
        x = document.createElement("div");
        x.className = "note";
        x.dataset.k = String(k);
        const id = `${g.id}-note-${k}`;
        x.innerHTML = `<label class="note-name" for="${id}"></label><textarea id="${id}" rows="1" spellcheck="false" placeholder="${t("Notes for this cage…")}"></textarea>`;
        const ta = x.querySelector("textarea")!;
        const grow = () => {
          ta.style.height = "auto";
          ta.style.height = `${ta.scrollHeight}px`;
        };
        ta.addEventListener("input", () => {
          if (ta.value) S.notes[k] = ta.value;
          else delete S.notes[k];
          grow();
          ctx.save();
        });
        ta.addEventListener("focus", () => {
          S.noteFocus = k;
          render();
        });
        ta.addEventListener("blur", () => {
          S.noteFocus = null;
          render();
        });
        ta.value = S.notes[k] ?? "";
        requestAnimationFrame(grow);
      }
      x.querySelector(".note-name")!.textContent = nt.name(p, k);
      x.classList.toggle("active", k === active);
      const ta = x.querySelector("textarea")!;
      if (document.activeElement !== ta && ta.value !== (S.notes[k] ?? "")) ta.value = S.notes[k] ?? "";
      // Keep the order: after the previous note.
      if (prev ? prev.nextElementSibling !== x : list.firstElementChild !== x) {
        if (prev) prev.after(x);
        else list.prepend(x);
      }
      prev = x;
    }
    el("notes").hidden = !order.length;
  }

  return { buildBoard, render };
}
