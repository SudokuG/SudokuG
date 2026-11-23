// The number pad: keys, the S key and sweeping (shared with the light page: ../pad-common.ts), the Erase / Clear colour button.

import { t } from "../i18n";
import { bit } from "../../engine";
import { paletteBit } from "../board";
import { afterChange, clearAllColors, editable, enterNumber, erase } from "./actions";
import { noPuzzle } from "./puzzles";
import { $, render, renderModes, setStatus } from "./render";
import { S, clone, effectiveMode, shownCands } from "./state";
import { wireSKey, wireSweep } from "../pad-common";
import type { Mode, Snapshot } from "./state";

export const padButtons: HTMLButtonElement[] = [];
export function buildPad(): void {
  const pad = $("pad");
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span class="num">${d}</span><span class="left"></span>`;
    b.dataset.d = String(d);
    // Keys act on the first touch (a phone drops the click when the finger moves a little,
    // or for a second finger while S is held). A click without a pointer (keyboard) still works.
    b.addEventListener("click", (e) => e.detail === 0 && enterNumber(d, effectiveMode(e.shiftKey)));
    pad.appendChild(b);
    padButtons.push(b);
  }
  // Tenth key, shown only in the phone layout (two rows of five): "S" works like a held
  // Shift key. Tapping cells adds them to the selection, and digits go in as candidates.
  const sticky = document.createElement("button");
  sticky.type = "button";
  sticky.id = "pad-sticky";
  sticky.className = "pad-sticky";
  sticky.textContent = "S";
  sticky.title = t("Like holding Shift: select several cells, enter candidates");
  wireSKey(sticky, {
    staysOn: () => S.settings.stickyToggle,
    isOn: () => S.sticky,
    set(on) {
      S.sticky = on;
      render();
    },
  });
  pad.appendChild(sticky);
  // Holding a key never selects its text or opens a menu or search.
  for (const ev of ["contextmenu", "selectstart"]) pad.addEventListener(ev, (e) => e.preventDefault());
  wirePadSweep(pad);
}

/**
 * Sweeping over the pad (pad-common.ts wireSweep): toggles those keys as candidates, or as
 * pairs or colours in those modes. Digit mode sweeps candidates, unless the Sweep in digit
 * mode option is off.
 */
function wirePadSweep(pad: HTMLElement): void {
  type Start = { before: Snapshot; undoLen: number; redo: Snapshot[]; mode: Mode; digit: boolean };
  /** The cells a sweep changes (judged on the state before the first key, which may have put a digit in). */
  const targets = (t: Start) => (t.mode === "color" ? [...S.selection] : editable().filter((i) => !t.before.values[i]));
  const has = (mode: Mode, i: number, d: number) =>
    mode === "color" ? !!(S.cur.colors[i] & paletteBit(S.palette, d)) : mode === "centre" ? !!(S.cur.centre[i] & bit(d)) : !!(shownCands(i) & bit(d));
  const put = (t: Start, d: number, add: boolean) => {
    for (const i of targets(t)) {
      const s = S.cur;
      if (t.mode === "color") s.colors[i] = add ? s.colors[i] | paletteBit(S.palette, d) : s.colors[i] & ~paletteBit(S.palette, d);
      else if (t.mode === "centre") s.centre[i] = add ? s.centre[i] | bit(d) : s.centre[i] & ~bit(d);
      else if (S.settings.auto) s.removed[i] = add ? s.removed[i] & ~bit(d) : s.removed[i] | bit(d);
      else s.pencil[i] = add ? s.pencil[i] | bit(d) : s.pencil[i] & ~bit(d);
    }
  };
  wireSweep<Start>(pad, "d", {
    down(d, e) {
      const m = effectiveMode(e.shiftKey);
      const t = S.cur ? { before: clone(S.cur), undoLen: S.undo.length, redo: S.redo.slice(), mode: m === "digit" ? ("pencil" as Mode) : m, digit: m === "digit" } : null;
      enterNumber(d, m);
      return t;
    },
    allowed: (t) => S.settings.sweep && !(t.digit && !S.settings.sweepDigit) && !S.finishing && !noPuzzle() && targets(t).length > 0,
    start(t, first) {
      // Whatever the first key did becomes a candidate (pair, colour) instead.
      S.cur = clone(t.before);
      S.undo.length = t.undoLen;
      S.redo = t.redo;
      const add = !targets(t).every((i) => has(t.mode, i, first));
      put(t, first, add);
      return add;
    },
    toggle: put,
    render,
    end(t, started) {
      if (!started || JSON.stringify(t.before) === JSON.stringify(S.cur)) return;
      S.undo.push(t.before);
      if (S.undo.length > 500) S.undo.shift();
      S.redo = [];
      afterChange();
    },
  });
}

/**
 * Erase button. In Colour mode it is "Clear colour": a tap clears the selected cells.
 * Held, it clears every colour in all palettes after HOLD_MS, without waiting for the
 * finger to lift. After a quarter second the label already says "Clear all colour", as a
 * hint that holding does something else. Sliding off the button first cancels.
 */
export const HOLD_MS = 600;
export function wireEraseButton(): void {
  const btn = $("erase");
  let hintTimer = 0;
  let fireTimer = 0;
  let firedAt = -Infinity;
  const reset = () => {
    clearTimeout(hintTimer);
    clearTimeout(fireTimer);
    if (!btn.classList.contains("armed")) return;
    btn.classList.remove("armed");
    renderModes();
  };
  btn.addEventListener("pointerdown", () => {
    reset();
    if (effectiveMode() !== "color") return;
    hintTimer = window.setTimeout(() => {
      btn.classList.add("armed");
      btn.textContent = t("Clear all colour");
    }, 250);
    fireTimer = window.setTimeout(() => {
      firedAt = performance.now();
      reset();
      clearAllColors();
      setStatus(t("All colours cleared, in all palettes."));
    }, HOLD_MS);
  });
  btn.addEventListener("pointerup", reset);
  btn.addEventListener("pointerleave", reset);
  btn.addEventListener("pointercancel", reset);
  btn.addEventListener("click", () => {
    if (performance.now() - firedAt < 1500) return void (firedAt = -Infinity); // the click that ends a hold
    erase();
  });
}
