// The number pad: keys, sweeping over keys for candidates, the Erase / Clear colour button.

import { bit } from "../../engine";
import { paletteBit } from "../board";
import { afterChange, clearAllColors, editable, enterNumber, erase } from "./actions";
import { noPuzzle } from "./puzzles";
import { $, render, renderModes, setStatus } from "./render";
import { S, clone, effectiveMode, shownCands } from "./state";
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
  sticky.title = "Like holding Shift: select several cells, enter candidates";
  // Default: active only while held. With the toggle option: tap on, tap off.
  sticky.addEventListener("pointerdown", (e) => {
    if (S.settings.stickyToggle) return;
    e.preventDefault();
    sticky.setPointerCapture(e.pointerId);
    S.sticky = true;
    render();
  });
  const release = () => {
    if (S.settings.stickyToggle || !S.sticky) return;
    S.sticky = false;
    render();
  };
  sticky.addEventListener("pointerup", release);
  sticky.addEventListener("pointercancel", release);
  sticky.addEventListener("lostpointercapture", release);
  sticky.addEventListener("contextmenu", (e) => e.preventDefault());
  sticky.addEventListener("click", () => {
    if (!S.settings.stickyToggle) return;
    S.sticky = !S.sticky;
    render();
  });
  pad.appendChild(sticky);
  // Holding a key never selects its text or opens a menu or search.
  for (const ev of ["contextmenu", "selectstart"]) pad.addEventListener(ev, (e) => e.preventDefault());
  wireSweep(pad);
}

/**
 * Keys act on the first touch (a phone drops the click when the finger moves a little, or
 * for a second finger while S is held). With the Sweep option, sliding on over other keys
 * toggles those as candidates (pairs or colours in those modes; digit mode sweeps
 * candidates), all in one undo step; the first key decides whether the sweep adds or removes.
 */
export function wireSweep(pad: HTMLElement): void {
  let sw: { id: number; keys: number[]; before: Snapshot; undoLen: number; redo: Snapshot[]; mode: Mode; add: boolean | null } | null = null;
  const keyAt = (x: number, y: number): number | null => {
    const k = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-d]");
    return k && pad.contains(k) ? Number(k.dataset.d) : null;
  };
  /** The cells a sweep changes, whether all have digit d, and adding or removing it. */
  // (Judged on the state before the first key, which may have put a digit in.)
  const targets = (mode: Mode) => (mode === "color" ? [...S.selection] : editable().filter((i) => !sw!.before.values[i]));
  const has = (mode: Mode, i: number, d: number) =>
    mode === "color" ? !!(S.cur.colors[i] & paletteBit(S.palette, d)) : mode === "centre" ? !!(S.cur.centre[i] & bit(d)) : !!(shownCands(i) & bit(d));
  const put = (mode: Mode, d: number, add: boolean) => {
    for (const i of targets(mode)) {
      const s = S.cur;
      if (mode === "color") s.colors[i] = add ? s.colors[i] | paletteBit(S.palette, d) : s.colors[i] & ~paletteBit(S.palette, d);
      else if (mode === "centre") s.centre[i] = add ? s.centre[i] | bit(d) : s.centre[i] & ~bit(d);
      else if (S.settings.auto) s.removed[i] = add ? s.removed[i] & ~bit(d) : s.removed[i] | bit(d);
      else s.pencil[i] = add ? s.pencil[i] | bit(d) : s.pencil[i] & ~bit(d);
    }
  };
  pad.addEventListener("pointerdown", (e) => {
    const d = keyAt(e.clientX, e.clientY);
    if (d === null || e.button > 0) return;
    e.preventDefault();
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic event */
    }
    const m = effectiveMode(e.shiftKey);
    sw = S.cur ? { id: e.pointerId, keys: [d], before: clone(S.cur), undoLen: S.undo.length, redo: S.redo.slice(), mode: m === "digit" ? "pencil" : m, add: null } : null;
    enterNumber(d, m);
  });
  pad.addEventListener("pointermove", (e) => {
    if (!sw || sw.id !== e.pointerId || !S.settings.sweep || S.finishing || noPuzzle()) return;
    const d = keyAt(e.clientX, e.clientY);
    if (d === null || sw.keys.includes(d) || !targets(sw.mode).length) return;
    if (sw.add === null) {
      // The sweep starts: whatever the first key did becomes a candidate (pair, colour) instead.
      S.cur = clone(sw.before);
      S.undo.length = sw.undoLen;
      S.redo = sw.redo;
      sw.add = !targets(sw.mode).every((i) => has(sw!.mode, i, sw!.keys[0]));
      put(sw.mode, sw.keys[0], sw.add);
    }
    sw.keys.push(d);
    put(sw.mode, d, sw.add);
    render();
  });
  const end = (e: PointerEvent) => {
    if (!sw || sw.id !== e.pointerId) return;
    const done = sw;
    sw = null;
    if (done.add === null || JSON.stringify(done.before) === JSON.stringify(S.cur)) return;
    S.undo.push(done.before);
    if (S.undo.length > 500) S.undo.shift();
    S.redo = [];
    afterChange();
  };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);
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
      btn.textContent = "Clear all colour";
    }, 250);
    fireTimer = window.setTimeout(() => {
      firedAt = performance.now();
      reset();
      clearAllColors();
      setStatus("All colours cleared, in all palettes.");
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
