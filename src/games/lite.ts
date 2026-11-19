// The page for the lighter puzzle types (Treasure Map, Futoshiki, …): one controller for
// everything they share, laid out like the sudoku page (Play, Puzzles, Options and
// Techniques tabs; the code row under the board, or at the bottom on a phone). Each type
// supplies a LiteGame (lite/types.ts): how to make, rate, encode and draw a puzzle, its board
// layout, extra marks (clue or sign states) and hints.
//
// Cells hold -1 (empty), -2 (a dot: "a digit goes here", types with X's), 0 (an X) or a
// digit. Candidates are bitmasks (bit d; bit 0 is a note for X) shown in the middle of the
// cell, small and framed, in the colour of entered digits.
//
// The page is split into parts in ./lite/ (see lite/ctx.ts): puzzles, editing, render,
// pointer, pad, guide, keys. This file sets up the context, the tabs and options, the timer,
// and wires the buttons.

import { liteOptionsFor } from "./lite/options";
import { puzzleName } from "../names";
import { currentGame, onGameChange, setGame } from "../ui/games";
import { setCurrentPrint } from "../ui/print-dialog";
import { fmtTime, markup } from "./lite/markup";
import { newState } from "./lite/ctx";
import type { LiteBase, LiteCtx, LiteParts } from "./lite/ctx";
import type { LiteGame, LitePuzzle, Tab, ThemeHooks } from "./lite/types";
import { puzzlesPart } from "./lite/puzzles";
import { editingPart } from "./lite/editing";
import { renderPart } from "./lite/render";
import { pointerPart } from "./lite/pointer";
import { padPart } from "./lite/pad";
import { guidePart } from "./lite/guide";
import { keysPart } from "./lite/keys";

const IDLE_MS = 2 * 60 * 1000;

/** Set up the page of one puzzle type inside `root` (a <main class="game-view lite">). */
export function initLite<P extends LitePuzzle>(g: LiteGame<P>, root: HTMLElement, theme?: ThemeHooks): void {
  root.innerHTML = markup(g, !!theme);
  const el = (r: string) => root.querySelector<HTMLElement>(`[data-r="${r}"]`)!;
  const store = liteOptionsFor(g.id, g.optionDefaults);
  const S = newState(g);
  const base: LiteBase<P> = {
    g,
    root,
    theme,
    el,
    all: (r) => root.querySelectorAll<HTMLElement>(`[data-r="${r}"]`),
    btn: (r) => el(r) as HTMLButtonElement,
    board: el("board"),
    active: () => currentGame() === g.id,
    store,
    opt: store.opt,
    S,
    cellEls: [],
    delays: new Map(),
    noCands: g.candidates === false,
    show: (v) => (g.glyph ? g.glyph(v) : v ? String(v) : "✕"),
    valueName: (v) => (g.valueName ? g.valueName(v) : v ? String(v) : "X"),
    n: () => S.p!.n,
    maxDigit: () => g.maxDigit(S.p!.n),
    nameOf: (code, level) => puzzleName(code, level, g.id),
    status: (msg, kind = "") => {
      const s = el("status");
      s.textContent = msg;
      s.className = "status" + (kind ? " " + kind : "");
    },
  };
  // The parts call each other through ctx, so they can be made in any order.
  const ctx = base as LiteCtx<P>;
  const parts: Omit<LiteParts<P>, "setTab" | "renderOptions"> = {
    ...puzzlesPart(ctx),
    ...editingPart(ctx),
    ...renderPart(ctx),
    ...pointerPart(ctx),
    ...padPart(ctx),
    ...guidePart(ctx),
    ...keysPart(ctx),
  };
  Object.assign(ctx, parts, { setTab, renderOptions });
  const { all, active, opt, status } = ctx;
  const { copyLink, newPuzzle, openPrint, printPuzzle, renderStats, restore, save, start, applyHint, check, erase, hint, redo, reveal, stopRingHold, undo, render, wirePad, buildGuideList, showGuide, onKey } = ctx;

  function renderOptions(): void {
    root.querySelectorAll<HTMLInputElement>("[data-opt]").forEach((box) => (box.checked = !!opt[box.dataset.opt as keyof typeof opt]));
    (el("finish") as HTMLSelectElement).value = String(opt.autoFinish);
    if (theme) (el("theme") as HTMLSelectElement).value = theme.get();
  }

  function setTab(t: Tab): void {
    S.tab = t;
    root.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== t));
    root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => {
      b.classList.toggle("on", b.dataset.tab === t);
      b.setAttribute("aria-selected", String(b.dataset.tab === t));
    });
    if (t === "options") renderOptions();
    root.classList.toggle("guiding", t === "techniques");
    el("guide").hidden = t !== "techniques";
    if (t === "techniques") showGuide(S.guide);
  }

  function startTimer(): void {
    const mark = () => (S.lastInput = Date.now());
    document.addEventListener("pointerdown", mark, { capture: true });
    document.addEventListener("keydown", mark, { capture: true });
    let last = Date.now();
    setInterval(() => {
      const now = Date.now();
      const dt = Math.min(now - last, 2000);
      last = now;
      const playing = active() && !!S.p && !S.solved && !S.making;
      const on = playing && document.visibilityState === "visible" && now - S.lastInput < IDLE_MS;
      if (on) S.elapsed += dt;
      const t = el("timer");
      t.textContent = fmtTime(S.elapsed);
      t.classList.toggle("paused", playing && !on);
    }, 500);
  }

  const picker = (r: string, values: string[], label: (v: string) => string, pick: (v: string) => void) =>
    el(r).replaceChildren(
      ...values.map((v) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.v = v;
        b.setAttribute("role", "radio");
        b.textContent = label(v);
        b.addEventListener("click", () => {
          pick(v);
          save();
          render();
        });
        return b;
      }),
    );
  picker("sizes", g.sizes.map(String), (v) => (g.sizeLabel ? g.sizeLabel(Number(v)) : `${v}×${v}`), (v) => (S.pickSize = Number(v)));
  picker("levels", [...g.levels], (v) => v, (v) => (S.pickLevel = v));
  root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab as Tab)));
  root.querySelectorAll<HTMLInputElement>("[data-opt]").forEach((box) =>
    box.addEventListener("change", () => store.set(box.dataset.opt as keyof typeof opt, box.checked)),
  );
  store.on(() => {
    renderOptions();
    if (S.p) render();
  });
  if (theme) el("theme").addEventListener("change", () => theme.set((el("theme") as HTMLSelectElement).value));
  el("finish").addEventListener("change", () => store.set("autoFinish", Number((el("finish") as HTMLSelectElement).value)));
  el("new").addEventListener("click", newPuzzle);
  el("solved-new").addEventListener("click", newPuzzle);
  el("restart").addEventListener("click", () => {
    if (!S.p) return;
    start(S.p, S.level);
    status("Restarted.");
    setTab("play");
  });
  el("undo").addEventListener("click", undo);
  el("redo").addEventListener("click", redo);
  el("erase").addEventListener("click", erase);
  root.querySelector('[data-r="mode"]')?.addEventListener("click", () => {
    S.pencil = !S.pencil;
    render();
  });
  el("check").addEventListener("click", check);
  el("reveal").addEventListener("click", reveal);
  el("hint").addEventListener("click", hint);
  el("hint-more").addEventListener("click", hint);
  el("hint-apply").addEventListener("click", applyHint);
  el("hint-close").addEventListener("click", () => {
    S.hint = null;
    S.wrong.clear();
    render();
  });
  all("copy").forEach((b) => b.addEventListener("click", copyLink));
  all("print").forEach((b) => b.addEventListener("click", () => openPrint(false)));
  el("print-many").addEventListener("click", () => openPrint(true));
  el("load").addEventListener("click", () => {
    try {
      start(g.decode((el("import") as HTMLInputElement).value.trim()));
      el("load-msg").textContent = "Loaded.";
      setTab("play");
    } catch (e) {
      el("load-msg").textContent = (e as Error).message;
    }
  });
  wirePad();
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", (e) => {
    if (active() && (e.key === "." || e.key === "o" || e.key === "O" || e.code === "NumpadDecimal")) stopRingHold();
    if (e.key === "Shift" && S.shift) {
      S.shift = false;
      if (S.p) render();
    }
  });
  window.addEventListener("blur", () => {
    if (!S.shift) return;
    S.shift = false;
    if (S.p) render();
  });
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && save());
  window.addEventListener("pagehide", save);
  setInterval(() => active() && save(), 15000);
  startTimer();
  renderStats();
  buildGuideList();
  setTab("play");

  const printCurrent = () => (S.p ? { puzzle: printPuzzle(S.p, S.level, false) } : null);
  const showPage = () => {
    root.classList.add("on");
    setCurrentPrint(printCurrent);
    renderOptions();
    if (!S.p && !restore()) newPuzzle();
    else if (S.p) render();
  };
  onGameChange((id) => {
    if (id === g.id) showPage();
    else root.classList.remove("on");
  });

  // A shared link opens that puzzle (continuing it if it was played here before).
  const hash = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : "";
  if (g.isCode(hash)) {
    try {
      const p = g.decode(hash);
      if (!restore(g.encode(p))) start(p);
      setGame(g.id);
      return;
    } catch {
      /* not a valid code: ignore it */
    }
  }
  if (active()) showPage();
}
