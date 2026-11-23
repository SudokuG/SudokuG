// Actions: every change to the game goes through change() (undo step), then afterChange().

import { t } from "../i18n";
import { Grid, PEERS, TECHNIQUES, bit, boxOf, colOf, getHint, logicalSolve, patternFirst, rowOf } from "../../engine";
import { PALETTES, paletteBit } from "../board";
import { recordSolve } from "./finish";
import { noPuzzle, saveSoon } from "./puzzles";
import { render, setStatus, setTab } from "./render";
import { MAX_ALT, S, SINGLES, clone, computed, effectiveMode, engineGrid, saveSettings, shownCands } from "./state";
import type { Mode, Snapshot } from "./state";

/** Record the current state for undo, then let `fn` change it. */
export function change(fn: (s: Snapshot) => void): boolean {
  const before = clone(S.cur);
  fn(S.cur);
  untidy(before, S.cur);
  if (JSON.stringify(before) === JSON.stringify(S.cur)) return false;
  S.undo.push(before);
  if (S.undo.length > 500) S.undo.shift();
  S.redo = [];
  afterChange();
  return true;
}

/**
 * A digit taken out again (erased, or replaced by another) gives back the candidates and pairs
 * that placing it removed: those its row, column and box had just before it went in (the last
 * undo step without it), unless a cell they see got the digit since.
 */
function untidy(before: Snapshot, s: Snapshot): void {
  if (!S.settings.tidy) return;
  for (let i = 0; i < 81; i++) {
    const d = before.values[i];
    if (!d || s.values[i] === d) continue;
    let k = S.undo.length - 1;
    while (k >= 0 && S.undo[k].values[i] === d) k--;
    const prev = S.undo[k];
    if (!prev) continue;
    const b = bit(d);
    for (const j of PEERS[i]) {
      if (s.values[j] || PEERS[j].some((x) => s.values[x] === d && prev.values[x] !== d)) continue;
      if (prev.pencil[j] & b) s.pencil[j] |= b;
      if (prev.centre[j] & b) s.centre[j] |= b;
    }
  }
}

export function afterChange(): void {
  S.hint = null;
  S.flash.clear();
  setStatus("");
  if (!S.solved && S.puzzle && S.cur.values.every((v, i) => v && (!S.solution || v === S.solution[i])) && !engineGrid().conflicts().size) {
    S.solved = true;
    recordSolve();
  }
  render();
  saveSoon();
}

/** Selected cells the player may change (digits and marks; colours work on givens too). */
export const editable = () => [...S.selection].filter((i) => !S.givens[i]);

// Actions

/** Toggle bit `b` in `masks` for `cells`: remove it everywhere if all have it, else add it everywhere. */
export function toggleAll(masks: number[], cells: number[], b: number, has: (i: number) => boolean): void {
  const allHave = cells.every(has);
  for (const i of cells) masks[i] = allHave ? masks[i] & ~b : masks[i] | b;
}

export function enterNumber(d: number, mode: Mode = effectiveMode()): void {
  if (S.finishing || noPuzzle()) return;
  if (!S.selection.size) {
    // Nothing selected: mark every cell with this digit, as a digit or a candidate.
    S.padDigit = S.padDigit === d ? 0 : d;
    return render();
  }
  if (mode === "color") {
    const cells = [...S.selection];
    if (!cells.length) return;
    const b = paletteBit(S.palette, d);
    // Painting into a hidden palette shows it again, or nothing would seem to happen.
    S.colorHidden[S.palette] = false;
    if (!change((s) => toggleAll(s.colors, cells, b, (i) => !!(S.cur.colors[i] & b)))) render();
    return;
  }
  const cells = editable();
  if (!cells.length) return;
  const empty = cells.filter((i) => !S.cur.values[i]);
  if (mode === "pencil") {
    if (!empty.length) return;
    const allHave = empty.every((i) => shownCands(i) & bit(d));
    change((s) => {
      for (const i of empty) {
        if (S.settings.auto) {
          if (allHave) s.removed[i] |= bit(d);
          else s.removed[i] &= ~bit(d);
        } else if (allHave) s.pencil[i] &= ~bit(d);
        else s.pencil[i] |= bit(d);
      }
    });
  } else if (mode === "centre") {
    if (!empty.length) return;
    change((s) => toggleAll(s.centre, empty, bit(d), (i) => !!(S.cur.centre[i] & bit(d))));
  } else {
    const allSame = cells.every((i) => S.cur.values[i] === d);
    if (!allSame) {
      // One digit in two cells of the same row, column or box is never right: a misclick.
      const shared = sharedUnit(cells);
      if (shared) return setStatus(t(`These cells share a ${shared}, so they can't all be {d}.`, { d }), "bad");
    }
    const changed = change((s) => {
      for (const i of cells) {
        if (allSame) s.values[i] = 0;
        else {
          s.values[i] = d;
          if (S.settings.tidy)
            for (const p of PEERS[i]) {
              s.pencil[p] &= ~bit(d);
              s.centre[p] &= ~bit(d);
            }
        }
      }
    });
    if (changed && !allSame) maybeAutoFinish();
  }
}

/** "row", "column" or "box" if two of the cells share one, else null. */
export function sharedUnit(cells: number[]): string | null {
  for (let a = 0; a < cells.length; a++)
    for (let b = a + 1; b < cells.length; b++) {
      const [x, y] = [cells[a], cells[b]];
      if (rowOf(x) === rowOf(y)) return "row";
      if (colOf(x) === colOf(y)) return "column";
      if (boxOf(x) === boxOf(y)) return "box";
    }
  return null;
}

/** Backspace: digits first, then candidates and pairs, then colours. In Colour mode, colours first. */
export function erase(): void {
  if (S.finishing || noPuzzle()) return;
  const sel = [...S.selection];
  const cells = editable();
  const target = colorsToClear();
  const anyColor = !!target;
  const clearColors = (s: Snapshot) => sel.forEach((i) => (s.colors[i] &= ~target));
  if (S.mode === "color" && anyColor) return void change(clearColors);
  const anyValue = cells.some((i) => S.cur.values[i]);
  const anyMarks = cells.some((i) => !S.cur.values[i] && (S.cur.pencil[i] || S.cur.removed[i] || S.cur.centre[i]));
  change((s) => {
    if (anyValue) cells.forEach((i) => (s.values[i] = 0));
    else if (anyMarks)
      cells.forEach((i) => {
        s.pencil[i] = 0;
        s.removed[i] = 0;
        s.centre[i] = 0;
      });
    else if (anyColor) clearColors(s);
  });
}

export const paletteMask = (p: number) => 511 << (p * 9);

/**
 * Which colour bits clearing the selection removes: the current palette's colours, or,
 * if the selected cells have none, the colours of every palette that is shown.
 */
export function colorsToClear(): number {
  const sel = [...S.selection];
  const cur = paletteMask(S.palette);
  if (!S.colorHidden[S.palette] && sel.some((i) => S.cur.colors[i] & cur)) return cur;
  let visible = 0;
  for (let p = 0; p < PALETTES; p++) if (!S.colorHidden[p]) visible |= paletteMask(p);
  return sel.some((i) => S.cur.colors[i] & visible) ? visible : 0;
}

/** Holding "Clear colour": wipe every colour on the board, in all palettes, shown or hidden. */
export function clearAllColors(): void {
  if (noPuzzle()) return;
  change((s) => s.colors.fill(0));
}

export function clearColorsOfSelection(): void {
  const target = colorsToClear();
  if (target) change((s) => S.selection.forEach((i) => (s.colors[i] &= ~target)));
}

export function doUndo(): void {
  if (S.finishing) return;
  const prev = S.undo.pop();
  if (!prev) return;
  S.redo.push(clone(S.cur));
  S.cur = prev;
  afterChange();
}

export function doRedo(): void {
  if (S.finishing) return;
  const next = S.redo.pop();
  if (!next) return;
  S.undo.push(clone(S.cur));
  S.cur = next;
  afterChange();
}

/** Write every possible candidate into the empty cells (manual mode). */
export function fillCandidates(): void {
  if (noPuzzle()) return;
  change((s) => {
    for (let i = 0; i < 81; i++) s.pencil[i] = s.values[i] ? 0 : computed(s.values, i) & ~s.removed[i];
  });
}

/** Wipe all candidates and pairs. Turns auto-candidates off, since it would otherwise show them again. */
export function clearCandidates(): void {
  if (S.settings.auto) {
    S.settings.auto = false;
    saveSettings();
  }
  change((s) => {
    s.pencil.fill(0);
    s.removed.fill(0);
    s.centre.fill(0);
  });
  render();
}

export function setAuto(on: boolean): void {
  if (on === S.settings.auto) return;
  change((s) => {
    if (on) {
      // Keep the player's own eliminations: anything not written down counts as removed.
      for (let i = 0; i < 81; i++) if (!s.values[i] && s.pencil[i]) s.removed[i] = computed(s.values, i) & ~s.pencil[i];
    } else {
      // Turning auto-candidates off wipes the automatic candidates.
      s.pencil.fill(0);
      s.removed.fill(0);
    }
  });
  S.settings.auto = on;
  saveSettings();
  S.hint = null;
  render();
}

/**
 * Auto-finish: when few cells are left, every digit so far is correct and the rest
 * follows from singles alone, fill in the rest one by one (as a single undo step).
 */
export function maybeAutoFinish(): void {
  const limit = S.settings.autoFinish;
  if (!limit || !S.solution || S.finishing) return;
  const values = S.cur.values;
  const left = values.filter((v) => !v).length;
  if (!left || left > limit) return;
  if (values.some((v, i) => v && v !== S.solution![i])) return;
  const log = logicalSolve(new Grid(values), SINGLES);
  if (!log.solved) return;
  const order = log.steps.flatMap((s) => s.placements);

  S.undo.push(clone(S.cur));
  S.redo = [];
  S.finishing = true;
  S.hint = null;
  const fast = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let k = 0;
  const tick = () => {
    const p = order[k++];
    S.cur.values[p.cell] = p.digit;
    S.popped.add(p.cell);
    render();
    if (k < order.length) setTimeout(tick, fast ? 0 : 80);
    else {
      S.finishing = false;
      afterChange();
      if (S.solved) setStatus(t("The last {n} cells were filled in for you.", { n: order.length }), "good");
      setTimeout(() => {
        S.popped.clear();
        render();
      }, 600);
    }
  };
  setTimeout(tick, fast ? 0 : 150);
}

export function showHint(): void {
  if (noPuzzle()) return;
  if (S.finishing) return;
  if (S.hint && S.hint.kind === "step" && S.hintLevel === 1) {
    S.hintLevel = 2;
  } else {
    S.hint = getHint(engineGrid(), S.solution, S.settings.patterns ? patternFirst(MAX_ALT) : TECHNIQUES);
    if (S.hint.kind === "step") S.hintsUsed++;
    S.hintLevel = 1;
    S.flash.clear();
    if (S.hint.kind === "error") S.hint.cells.forEach((c) => S.flash.add(c));
  }
  if (S.tab !== "play") setTab("play");
  render();
}

export function applyHint(): void {
  if (!S.hint || S.hint.kind !== "step") return;
  const step = S.hint.step;
  change((s) => {
    for (const e of step.eliminations) {
      s.removed[e.cell] |= bit(e.digit);
      s.pencil[e.cell] &= ~bit(e.digit);
      s.centre[e.cell] &= ~bit(e.digit);
    }
    for (const p of step.placements) {
      s.values[p.cell] = p.digit;
      for (const q of PEERS[p.cell]) {
        s.pencil[q] &= ~bit(p.digit);
        s.centre[q] &= ~bit(p.digit);
      }
    }
  });
  if (step.placements.length) {
    select(step.placements[0].cell, false);
    maybeAutoFinish();
  }
  render();
}

export function check(): void {
  if (noPuzzle()) return;
  S.flash.clear();
  if (!S.solution) return setStatus(t("Check needs a puzzle with exactly one solution."), "bad");
  const wrong: number[] = [];
  let empty = 0;
  S.cur.values.forEach((v, i) => {
    if (!v) empty++;
    else if (v !== S.solution![i]) wrong.push(i);
  });
  wrong.forEach((c) => S.flash.add(c));
  if (wrong.length) setStatus(t(wrong.length === 1 ? "1 digit is wrong (marked red)." : "{n} digits are wrong (marked red).", { n: wrong.length }), "bad");
  else if (empty) setStatus(t(empty === 1 ? "Everything is correct so far. 1 cell to go." : "Everything is correct so far. {n} cells to go.", { n: empty }), "good");
  render();
}

export function select(i: number, extend: boolean): void {
  S.padDigit = 0;
  if (!extend) S.selection.clear();
  S.selection.add(i);
  S.primary = i;
}
