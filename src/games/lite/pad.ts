// The number pad: keys (acting on the first touch), the S key, sweeping over keys.

import { RING } from "../logic";
import type { LiteCtx } from "./ctx";
import type { LitePuzzle, Snap } from "./types";

export function padPart<P extends LitePuzzle>(ctx: LiteCtx<P>) {
  const { g, el, opt, S, noCands, show, valueName, maxDigit } = ctx;

  function setSticky(on: boolean): void {
    S.sticky = on;
    ctx.render();
  }

  /**
   * The pad. Keys act on the first touch (a phone drops the click when the finger moves a
   * little, or for a second finger while S is held). Sliding the finger on over other keys
   * (a sweep) toggles those candidates too, all in one undo step: the first key decides
   * whether the sweep adds or removes them. Holding the ring key clears every ring.
   */
  let sweep: { id: number; keys: Set<number>; before: Snap; undoLen: number; add: boolean | null } | null = null;
  const keyAt = (x: number, y: number): number | null => {
    const k = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-v]");
    return k && el("pad").contains(k) ? Number(k.dataset.v) : null;
  };
  /** Candidates a sweep may toggle: digits, and ✕ in types with X's. */
  const sweepable = (v: number) => !noCands && v !== RING && (v > 0 || !!g.xPerLine);

  function buildPad(): void {
    const pad = el("pad");
    const keys: (number | "S")[] = [...Array.from({ length: maxDigit() }, (_, k) => k + 1), ...(g.xPerLine ? (noCands ? [0] : [0, RING]) : []), "S"];
    const visible = keys.length - 1; // the S key only shows on phones
    pad.style.setProperty("--keys", String(Math.min(visible, 8)));
    // On a phone: one row up to 5 keys, otherwise two rows (wider keys, as in sudoku).
    const cols = keys.length <= 5 ? keys.length : Math.min(5, Math.ceil(keys.length / 2));
    pad.style.setProperty("--keys-phone", String(cols));
    // The S key fills what is left of the last row, so the rows end evenly.
    pad.style.setProperty("--s-span", String(Math.ceil(keys.length / cols) * cols - keys.length + 1));
    pad.replaceChildren(
      ...keys.map((v) => {
        const b = document.createElement("button");
        b.type = "button";
        if (v === "S") {
          b.textContent = "S";
          b.className = "pad-sticky";
          b.title = noCands ? "Hold to select several cells" : "Hold to select several cells and enter candidates";
          b.setAttribute("aria-label", noCands ? "S: select several cells" : "S: select several cells, enter candidates");
          // Held: on while the finger is down. With "S key stays on": tap on, tap off.
          b.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (opt.stickyToggle) return setSticky(!S.sticky);
            try {
              b.setPointerCapture(e.pointerId);
            } catch {
              /* no active pointer (synthetic event): S stays on until pointerup anyway */
            }
            setSticky(true);
          });
          const release = () => !opt.stickyToggle && S.sticky && setSticky(false);
          b.addEventListener("pointerup", release);
          b.addEventListener("pointercancel", release);
          b.addEventListener("lostpointercapture", release);
          b.addEventListener("click", (e) => e.detail === 0 && opt.stickyToggle && setSticky(!S.sticky));
          return b;
        }
        b.dataset.v = String(v);
        if (v === RING) {
          b.innerHTML = `<span class="ring-key" aria-hidden="true"></span>`;
          b.setAttribute("aria-label", "Ring: a digit goes here, not an X");
          b.title = "Ring: a digit goes here, not an X (O or full stop). Hold 2 seconds to clear all rings";
          b.classList.add("dot-key");
        } else {
          b.innerHTML = show(v) + (v > 0 ? `<span class="left"></span>` : "");
          b.title = g.valueName ? `${valueName(v)} (${v ? "1" : "0 or X"})` : v === 0 ? "X: a cell without a digit (X or 0)" : String(v);
          if (g.valueName) b.setAttribute("aria-label", valueName(v));
          if (v === 0) b.classList.add("x-key");
        }
        // A click without a pointer (keyboard: Enter or Space on the key).
        b.addEventListener("click", (e) => e.detail === 0 && ctx.enter(v));
        return b;
      }),
    );
  }

  function wirePad(): void {
    const pad = el("pad");
    for (const ev of ["contextmenu", "selectstart"]) pad.addEventListener(ev, (e) => e.preventDefault());
    pad.addEventListener("pointerdown", (e) => {
      const v = keyAt(e.clientX, e.clientY);
      if (v === null || e.button > 0) return;
      e.preventDefault();
      try {
        pad.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic event */
      }
      sweep = { id: e.pointerId, keys: new Set([v]), before: ctx.snap(), undoLen: S.undo.length, add: null };
      if (v === RING) ctx.startRingHold();
      ctx.enter(v);
    });
    pad.addEventListener("pointermove", (e) => {
      if (!sweep || sweep.id !== e.pointerId || !S.p || !opt.sweep) return;
      const v = keyAt(e.clientX, e.clientY);
      if (v === null || sweep.keys.has(v)) return;
      ctx.stopRingHold();
      const first = [...sweep.keys][0];
      // (Open cells as before the first key, which may have put a digit in.)
      const open = ctx.editable().some((i) => sweep!.before.cells[i] < 0);
      if (!sweepable(v) || !sweepable(first) || !open || S.solved || S.finishing) return;
      if (sweep.add === null) {
        // The sweep starts: whatever the first key did becomes a candidate instead.
        S.cur = { cells: sweep.before.cells.slice(), cands: sweep.before.cands.slice() };
        S.undo.length = sweep.undoLen;
        sweep.add = !ctx.allHaveCand(first);
        ctx.setCand(S.cur, first, sweep.add);
      }
      sweep.keys.add(v);
      ctx.setCand(S.cur, v, sweep.add);
      ctx.render();
    });
    const end = (e: PointerEvent) => {
      if (!sweep || sweep.id !== e.pointerId) return;
      const sw = sweep;
      sweep = null;
      ctx.stopRingHold();
      if (sw.add !== null) ctx.commitFrom(sw.before);
    };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
  }

  return { buildPad, wirePad };
}
