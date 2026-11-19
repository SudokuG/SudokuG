// The keyboard: arrows move, digits enter, shortcuts.

import { RING } from "../logic";
import type { LiteCtx } from "./ctx";
import type { LitePuzzle } from "./types";

export function keysPart<P extends LitePuzzle>(ctx: LiteCtx<P>) {
  const { g, active, opt, S, noCands, n, maxDigit } = ctx;

  function move(dr: number, dc: number, extend: boolean): void {
    const N = n();
    S.quiet = false;
    S.sel = ((Math.floor(S.sel / N) + dr + N) % N) * N + (((S.sel % N) + dc + N) % N);
    if (extend) ctx.addCell(S.sel);
    else ctx.setSelection([S.sel]);
    ctx.render();
  }

  function onKey(e: KeyboardEvent): void {
    if (!active() || !S.p) return;
    if (e.key === "Shift" && !S.shift) {
      S.shift = true;
      ctx.render();
    }
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || document.querySelector("dialog[open]")) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k.toLowerCase() === "y" || (k.toLowerCase() === "z" && e.shiftKey))) {
      e.preventDefault();
      return ctx.redo();
    }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") {
      e.preventDefault();
      return ctx.undo();
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Digits by key code, so Shift+digit still works. On Windows, Shift+number pad arrives
    // without shiftKey (as "End", "ArrowDown", …): that counts as Shift too (so this comes
    // before the arrow keys, as in sudoku). With the option, the number pad always enters
    // candidates.
    if (g.keyAliases && k in g.keyAliases) {
      e.preventDefault();
      return ctx.enter(g.keyAliases[k]);
    }
    const code = /^(Digit|Numpad)([0-9])$/.exec(e.code);
    if (code) {
      const d = Number(code[2]);
      const numpad = code[1] === "Numpad";
      if ((d >= 1 && d <= maxDigit()) || (d === 0 && g.xPerLine)) {
        e.preventDefault();
        return ctx.enter(d, d > 0 && numpad && (opt.numpadCands || !/^[0-9]$/.test(k)));
      }
      if (numpad) return void e.preventDefault();
    }
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) {
      e.preventDefault();
      return move(...arrows[k], e.shiftKey);
    }
    if (g.xPerLine && (k === "x" || k === "X")) {
      e.preventDefault();
      return ctx.enter(0);
    }
    if (g.xPerLine && !noCands && (k === "." || k === "o" || k === "O" || e.code === "NumpadDecimal")) {
      e.preventDefault();
      if (e.repeat) return;
      ctx.startRingHold();
      return ctx.enter(RING);
    }
    if (k === "Backspace" || k === "Delete") {
      e.preventDefault();
      return ctx.erase();
    }
    if (k === "h" || k === "H") {
      e.preventDefault();
      return ctx.hint();
    }
    if (k === "Escape" && S.hint) {
      S.hint = null;
      return ctx.render();
    }
    if (k === " " && !noCands) {
      e.preventDefault();
      S.pencil = !S.pencil;
      return ctx.render();
    }
  }

  return { onKey };
}
