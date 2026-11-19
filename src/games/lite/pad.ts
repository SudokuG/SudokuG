// The number pad: keys (acting on the first touch), the S key, sweeping over keys (the last two
// shared with sudoku: ../../ui/pad-common.ts).

import { RING } from "../logic";
import type { LiteCtx } from "./ctx";
import type { LitePuzzle, Snap } from "./types";
import { wireSKey, wireSweep } from "../../ui/pad-common";

export function padPart<P extends LitePuzzle>(ctx: LiteCtx<P>) {
  const { g, el, opt, S, noCands, show, valueName, maxDigit } = ctx;

  function setSticky(on: boolean): void {
    S.sticky = on;
    ctx.render();
  }

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
          wireSKey(b, { staysOn: () => opt.stickyToggle, isOn: () => S.sticky, set: setSticky });
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

  /**
   * Sweeping over the pad (../../ui/pad-common.ts wireSweep): toggles those candidates;
   * entering digits, only with Sweep in digit mode. Holding the ring key clears every ring.
   */
  function wirePad(): void {
    const pad = el("pad");
    for (const ev of ["contextmenu", "selectstart"]) pad.addEventListener(ev, (e) => e.preventDefault());
    type Start = { before: Snap; undoLen: number; digit: boolean };
    wireSweep<Start>(pad, "v", {
      down(v) {
        const t = { before: ctx.snap(), undoLen: S.undo.length, digit: !ctx.pencilOn() };
        if (v === RING) ctx.startRingHold();
        ctx.enter(v);
        return t;
      },
      allowed(t, first, v) {
        if (!S.p || !opt.sweep || (t.digit && !opt.sweepDigit)) return false;
        ctx.stopRingHold();
        // (Open cells as before the first key, which may have put a digit in.)
        const open = ctx.editable().some((i) => t.before.cells[i] < 0);
        return sweepable(v) && sweepable(first) && open && !S.solved && !S.finishing;
      },
      start(t, first) {
        // Whatever the first key did becomes a candidate instead.
        S.cur = { cells: t.before.cells.slice(), cands: t.before.cands.slice() };
        S.undo.length = t.undoLen;
        const add = !ctx.allHaveCand(first);
        ctx.setCand(S.cur, first, add);
        return add;
      },
      toggle: (_t, v, add) => ctx.setCand(S.cur, v, add),
      render: () => ctx.render(),
      end(t, started) {
        ctx.stopRingHold();
        if (started) ctx.commitFrom(t.before);
      },
    });
  }

  return { buildPad, wirePad };
}
