// Rendering the sudoku page: the board, colour tools, mode buttons, render(); setMode, setTab.

import { Grid, bit, boxOf, colOf, digitsOf, isGrindyStep, rowOf } from "../../engine";
import type { Step } from "../../engine";
import { BoardView, PALETTES, paintBackground, stepDecor, stripes } from "../board";
import { currentGame } from "../games";
import { showGuide } from "../guide-view";
import { select } from "./actions";
import { renderLikes, renderSolved } from "./finish";
import { padButtons } from "./pad";
import { currentName } from "./puzzles";
import { S, TABS, effectiveMode, empty81, engineCands, shownCands } from "./state";
import type { Mode, Tab } from "./state";


export const $ = (id: string) => document.getElementById(id)!;
export const boardEl = $("board");
export let view: BoardView;

export function buildBoard(): void {
  view = new BoardView(boardEl);

  // Selecting with the mouse or a finger: click, drag, Shift to add, Ctrl/Cmd to remove.
  let drag: "add" | "remove" | null = null;
  const cellAt = (x: number, y: number): number | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(".cell");
    return el && boardEl.contains(el) ? Number(el.dataset.i) : null;
  };
  boardEl.addEventListener("pointerdown", (e) => {
    const i = cellAt(e.clientX, e.clientY);
    if (i === null) return;
    e.preventDefault();
    boardEl.focus({ preventScroll: true });
    if (e.ctrlKey || e.metaKey || (S.sticky && S.selection.has(i) && S.selection.size > 1)) {
      // Ctrl, or tapping a selected cell while S is on: take it out of the selection.
      drag = "remove";
      S.padDigit = 0;
      S.selection.delete(i);
      if (S.primary === i) S.primary = [...S.selection].pop() ?? i;
    } else {
      drag = "add";
      select(i, e.shiftKey || S.sticky);
    }
    boardEl.setPointerCapture(e.pointerId);
    render();
  });
  boardEl.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i === null) return;
    if (drag === "add" && !(S.selection.has(i) && S.primary === i)) {
      select(i, true);
      render();
    } else if (drag === "remove" && S.selection.has(i)) {
      S.selection.delete(i);
      render();
    }
  });
  const end = () => (drag = null);
  boardEl.addEventListener("pointerup", end);
  boardEl.addEventListener("pointercancel", end);
  // Tapping outside the grid (not on a control) selects nothing, so no shading is in the way.
  document.addEventListener("pointerdown", (e) => {
    if (currentGame() !== "sudoku" || !S.selection.size) return;
    const t = e.target as HTMLElement;
    if (boardEl.contains(t) || t.closest("button, input, select, textarea, label, a, summary, dialog, .pad, .modes, .color-tools")) return;
    S.selection.clear();
    render();
  });
}

export const EYE_OPEN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
export const EYE_SHUT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20 20 4"/></svg>`;
export const PALETTE_NAMES = ["solid", "stripes /", "stripes \\"];

/** The palette and eye buttons, shown only in Colour mode. */
export function renderColorTools(): void {
  const show = S.mode === "color";
  $("color-tools").hidden = !show;
  if (!show) return;
  const p = S.palette;
  ($("pal-icon") as HTMLElement).style.background =
    p === 0 ? "conic-gradient(from 45deg, var(--c2) 0 120deg, var(--c5) 120deg 240deg, var(--c7) 240deg)" : `${stripes(p, [2, 5, 7], "3px", "2px")}, var(--btn)`;
  $("pal-label").textContent = `Palette ${p + 1}`;
  $("palette").setAttribute("aria-label", `Palette ${p + 1} of ${PALETTES} (${PALETTE_NAMES[p]}). Tap for the next one.`);
  const hidden = S.colorHidden[p];
  const eye = $("eye");
  eye.innerHTML = `${hidden ? EYE_SHUT : EYE_OPEN}<span>${hidden ? "Hidden" : "Shown"}</span>`;
  eye.setAttribute("aria-pressed", String(hidden));
  eye.setAttribute("aria-label", hidden ? `Palette ${p + 1} is hidden. Tap to show it.` : `Palette ${p + 1} is shown. Tap to hide it.`);
}

export function renderModes(): void {
  const m = effectiveMode();
  boardEl.className = `board mode-${m}`;
  document.querySelectorAll<HTMLButtonElement>("#modes .mode-btn").forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
  const pad = $("pad");
  pad.className = `pad pad-${m} base-${S.mode}${m === "color" && S.colorHidden[S.palette] ? " pal-hidden" : ""}`;
  const counts = new Array(10).fill(0);
  S.cur?.values.forEach((v) => v && counts[v]++);
  const names: Record<Mode, string> = { digit: "Digit", pencil: "Candidate", centre: "Pair", color: "Colour" };
  padButtons.forEach((b, k) => {
    const left = 9 - counts[k + 1];
    (b.querySelector(".left") as HTMLElement).textContent = m === "digit" && left > 0 && S.settings.padCounts ? String(left) : "";
    const d = k + 1;
    b.style.setProperty("--swatch", S.palette === 0 ? `linear-gradient(var(--c${d}), var(--c${d}))` : stripes(S.palette, [d], "5px", "4px"));
    // A digit that is complete is greyed out for digits, candidates and pairs alike.
    b.classList.toggle("done", m !== "color" && left <= 0);
    b.setAttribute("aria-label", m === "digit" ? `Digit ${k + 1}, ${Math.max(left, 0)} left` : m === "color" ? `Colour ${k + 1}, palette ${S.palette + 1}` : `${names[m]} ${k + 1}`);
  });
  if (!$("erase").classList.contains("armed")) $("erase").textContent = m === "color" ? "Clear colour" : "Erase";
  $("erase").title = m === "color" ? "Clear the colour of the selected cells. Hold to clear all colours, in all palettes." : "Erase (Backspace)";
  renderColorTools();
  const sticky = $("pad-sticky");
  sticky.classList.toggle("on", S.sticky);
  sticky.setAttribute("aria-pressed", String(S.sticky));
}

export function render(): void {
  const { values, colors, centre } = S.cur;
  const set = S.settings;
  const prim = S.primary;
  // The digit to highlight: that of the first selected cell with a digit, so adding
  // cells to the selection (Shift, S key, dragging) keeps the highlight you started with.
  const hlCell = S.selection.size ? [...S.selection].find((i) => values[i]) ?? prim : -1;
  // A digit tapped on the pad with nothing selected wins (and shows even with "same digit" off).
  const pd = S.selection.size ? 0 : S.padDigit;
  const primVal = pd || (hlCell >= 0 ? values[hlCell] : 0);
  const sameOn = set.same || !!pd;
  const clashes = new Grid(values, empty81()).conflicts();
  const single = S.selection.size === 1 && !!S.puzzle;

  const hint = S.hint;
  const step: Step | null = hint && hint.kind === "step" ? hint.step : null;
  const full = !!step && S.hintLevel === 2;
  const decor = stepDecor(step, full);
  view.drawLinks(full ? step : null);

  for (let i = 0; i < 81; i++) {
    const el = view.cells[i];
    const v = values[i];
    const isPeer = single && i !== prim && ((set.peers && (rowOf(i) === rowOf(prim) || colOf(i) === colOf(prim))) || (set.box && boxOf(i) === boxOf(prim)));
    el.classList.toggle("given", S.givens[i]);
    el.classList.toggle("sel", !!S.puzzle && S.selection.has(i));
    el.classList.toggle("primary", !!S.puzzle && i === prim && S.selection.has(i));
    el.classList.toggle("peer", isPeer);
    el.classList.toggle("same", sameOn && !!primVal && v === primVal && i !== hlCell);
    // Cells with the digit as a candidate or pair: a lighter shade (option; always for a pad digit).
    el.classList.toggle("cand-same", (!!pd || (set.same && set.candShade)) && !!primVal && !v && !!((shownCands(i) | centre[i]) & bit(primVal)));
    el.classList.toggle("region", decor.region.has(i));
    el.classList.toggle("pattern", decor.pattern.has(i));
    el.classList.toggle("target", decor.target.has(i));
    el.classList.toggle("error", S.flash.has(i));
    el.classList.toggle("clash", clashes.has(i));
    el.classList.toggle("mistake", set.mistakes && !!S.solution && !S.givens[i] && !!v && v !== S.solution[i]);
    el.classList.toggle("pop", S.popped.has(i));
    view.paint[i].style.background = paintBackground(colors[i], S.colorHidden);
    view.vals[i].textContent = v ? String(v) : "";

    // Pairs are shown in the centre and replace the candidate grid, except during a full
    // hint, when the candidates the engine reasons with are shown so the whole pattern is visible.
    const showCentre = !v && !!centre[i] && !full;
    const cd = digitsOf(centre[i]);
    if (showCentre) {
      const pill = document.createElement("span");
      pill.className = "pill";
      for (const d of cd) {
        const ds = document.createElement("span");
        ds.textContent = String(d);
        if (sameOn && primVal === d) ds.className = "hl";
        pill.appendChild(ds);
      }
      view.centre[i].replaceChildren(pill);
    } else if (view.centre[i].firstChild) view.centre[i].replaceChildren();
    view.centre[i].className = `centre${cd.length > 3 ? " many" : ""}`;
    const m = v || showCentre ? 0 : full ? shownCands(i) | engineCands(i) : shownCands(i);
    for (let d = 1; d <= 9; d++) {
      const s = view.cands[i][d - 1];
      const on = !!(m & bit(d));
      s.textContent = on ? String(d) : "";
      s.className = on ? decor.candClass.get(i * 10 + d) ?? (sameOn && primVal === d ? "hl" : "") : "";
    }
    el.setAttribute("aria-label", `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}: ${v ? v : "empty"}`);
    el.setAttribute("aria-selected", String(S.selection.has(i)));
  }

  view.drawSelection(S.puzzle && set.outline ? S.selection : new Set());
  renderModes();
  ($("undo") as HTMLButtonElement).disabled = !S.undo.length;
  ($("redo") as HTMLButtonElement).disabled = !S.redo.length;
  $("fill-cands").hidden = set.auto;
  $("puzzle-label").textContent = S.puzzle ? S.label : "No puzzle yet";
  $("puzzle-name").textContent = currentName();
  $("puzzle-name").hidden = !S.puzzle;
  $("puzzle-author").hidden = !S.puzzle || !S.author;
  $("puzzle-author").textContent = S.author ? `By ${S.author}` : "";
  renderSolved();
  document.querySelectorAll<HTMLElement>(".layout .puzzle-code").forEach((el) => (el.textContent = S.code));
  document.querySelectorAll<HTMLElement>(".layout .code-row").forEach((el) => (el.hidden = !S.puzzle));
  $("timer").hidden = !set.timer || !S.puzzle;

  // Options
  (["auto", "mistakes", "tidy", "peers", "box", "same", "timer", "patterns", "stickyToggle", "padCounts", "numpadCands", "toPlay", "outline", "candShade", "sweep", "sweepDigit"] as const).forEach((k) => (($(`opt-${k}`) as HTMLInputElement).checked = set[k]));
  ($("opt-finish") as HTMLSelectElement).value = String(set.autoFinish);
  ($("opt-theme") as HTMLSelectElement).value = set.theme;

  // Hint card
  const card = $("hint-card");
  card.hidden = !hint;
  card.classList.toggle("error", hint?.kind === "error");
  const more = $("hint-more") as HTMLButtonElement;
  const apply = $("hint-apply") as HTMLButtonElement;
  const chain = $("hint-chain");
  chain.hidden = true;
  $("hint-note").hidden = true;
  if (hint) {
    if (hint.kind === "step") {
      $("hint-tech").textContent = hint.step.technique;
      $("hint-text").textContent = full ? hint.step.explanation : hint.step.nudge;
      const forced = set.patterns && isGrindyStep(hint.step);
      $("hint-note").hidden = !forced;
      if (forced)
        $("hint-note").textContent = hint.step.chainDigits
          ? "Nothing shorter works here, so this long chain is the way forward."
          : "No fish, wing, kite or coloring move works here, so this subset is the way forward.";
      if (full && hint.step.notation) {
        chain.textContent = hint.step.notation;
        chain.hidden = false;
      }
      more.hidden = full;
      apply.hidden = !full;
    } else {
      $("hint-tech").textContent = hint.kind === "error" ? "Something is off" : hint.kind === "solved" ? "Solved" : "No hint available";
      $("hint-text").textContent = hint.message;
      more.hidden = true;
      apply.hidden = true;
    }
  }

  document.querySelectorAll<HTMLButtonElement>(".chip").forEach((c) => c.classList.toggle("on", c.dataset.puzzle === S.puzzle));
}

export function setStatus(msg: string, kind: "" | "good" | "bad" = ""): void {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

export function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function setMode(m: Mode): void {
  S.mode = m;
  render();
}

export function setTab(t: Tab): void {
  S.tab = t;
  for (const name of TABS) {
    $(`pane-${name}`).hidden = name !== t;
    $(`tab-${name}`).classList.toggle("on", name === t);
    $(`tab-${name}`).setAttribute("aria-selected", String(name === t));
  }
  if (t === "puzzles") renderLikes();
  $("play-view").hidden = t === "techniques";
  $("guide-view").hidden = t !== "techniques";
  if (t === "techniques") showGuide();
}
