// Changing the game: entering values and candidates, undo/redo, automatic crosses,
// auto-finish, check, reveal and hints. Every change goes through change() (one undo step).

import { RING, liteHint, singlesFinish } from "../logic";
import { fmtTime } from "./markup";
import { t } from "../../ui/i18n";
import type { LiteCtx } from "./ctx";
import type { LitePuzzle, Snap } from "./types";

export function editingPart<P extends LitePuzzle>(ctx: LiteCtx<P>) {
  const { g, el, opt, S, noCands, n, maxDigit, status } = ctx;

  const editable = () => [...S.selection].filter((i) => !S.p!.givens[i]);
  /** Digits of the puzzle as a mask (bits 1..m). */
  const digitMask = () => ((1 << (maxDigit() + 1)) - 1) & ~1;
  const entries = () => ({ n: n(), solution: S.p!.solution, givens: S.p!.givens, cells: S.cur.cells, cands: S.cur.cands, digits: digitMask() });

  function change(fn: (s: Snap) => void): void {
    if (S.solved || !S.p || S.finishing) return;
    const before: Snap = { cells: S.cur.cells.slice(), cands: S.cur.cands.slice() };
    fn(S.cur);
    untidy(before, S.cur);
    autoDots(before, S.cur);
    if (JSON.stringify(before) === JSON.stringify(S.cur)) return;
    pushUndo(before);
    afterChange();
  }

  /** A step to undo (a new change also ends what Redo could bring back). */
  function pushUndo(before: Snap): void {
    S.undo.push(before);
    if (S.undo.length > 300) S.undo.shift();
    S.redo = [];
  }

  /** Marks an X that "Cross automatically" placed (in the candidates, which such types don't use). */
  const AUTO = 1;
  /**
   * "Cross automatically" (types with autoMarks): when a value was added, X the cells that must
   * be empty; X's placed that way go again once nothing requires them (a star taken away).
   */
  function autoDots(before: Snap, s: Snap): void {
    if (!g.autoMarks || !S.p) return;
    s.cells.forEach((v, i) => v !== 0 && s.cands[i] === AUTO && (s.cands[i] = 0));
    if (!opt.autoDots) return;
    const forced = g.autoMarks(S.p, s.cells);
    const added = s.cells.map((v, i) => (v > 0 && before.cells[i] !== v ? i : -1)).filter((i) => i >= 0);
    if (added.length) {
      const fresh = [...forced].filter((i) => s.cells[i] === -1 && !S.p!.givens[i]);
      fresh.forEach((i) => ((s.cells[i] = 0), (s.cands[i] = AUTO)));
      ripple(added, fresh);
    }
    s.cells.forEach((v, i) => {
      if (v === 0 && s.cands[i] === AUTO && !forced.has(i)) {
        s.cells[i] = -1;
        s.cands[i] = 0;
      }
    });
  }

  /** New marks in `cells` appear in a quick wave outwards from the cells `from` (a new star). */
  function ripple(from: number[], cells: number[]): void {
    if (!from.length) return;
    const N = n();
    for (const i of cells) {
      const d = Math.min(...from.map((f) => Math.hypot(Math.floor(i / N) - Math.floor(f / N), (i % N) - (f % N))));
      ctx.delays.set(i, Math.round(Math.max(0, d - 1) * 30));
    }
  }

  function afterChange(): void {
    S.wrong.clear();
    S.hint = null;
    status("");
    const done = g.isSolved ? g.isSolved(S.p!, S.cur.cells) : S.cur.cells.every((v, i) => v === S.p!.solution[i]);
    if (done) {
      // (Star Battle: the cells left open are empty.)
      const open = S.cur.cells.map((v, i) => (v === -1 ? i : -1)).filter((i) => i >= 0);
      open.forEach((i) => (S.cur.cells[i] = S.p!.solution[i]));
      ripple(S.selOrder.filter((i) => S.cur.cells[i] > 0).slice(-1), open);
      S.solved = true;
      el("solved-text").textContent = ctx.recordSolve();
      status(t("Solved in {time}.", { time: fmtTime(S.elapsed) }), "good");
    }
    ctx.render();
    ctx.save();
    if (!S.solved) maybeFinish();
  }

  /**
   * Auto-finish: when at most `autoFinish` cells are left, every entry is right and the rest
   * follows from singles, fill it in one cell at a time.
   */
  function maybeFinish(): void {
    const left = S.cur.cells.filter((v) => v < 0).length;
    if (!opt.autoFinish || left > opt.autoFinish || S.finishing) return;
    const all = singlesFinish(g.solver(S.p!), entries());
    if (!all) return;
    // (Star Battle: only the stars; the open cells left are empty once it is solved.)
    const order = g.isSolved ? all.filter((x) => x.value > 0) : all;
    S.finishing = true;
    const before: Snap = { cells: S.cur.cells.slice(), cands: S.cur.cands.slice() };
    status(t("The rest follows from singles: filling it in."));
    let k = 0;
    const tick = () => {
      if (k < order.length && S.p) {
        const { cell, value } = order[k++];
        S.cur.cells[cell] = value;
        ctx.cellEls[cell]?.classList.add("pop");
        ctx.render();
        return void setTimeout(tick, 110);
      }
      S.finishing = false;
      pushUndo(before);
      ctx.cellEls.forEach((c) => c?.classList.remove("pop"));
      afterChange();
    };
    setTimeout(tick, 250);
  }

  /** Remove digit v from the candidates in the row and column of cell i (when that option is on). */
  const tidy = (s: Snap, i: number, v: number) => {
    if (!opt.tidy || v <= 0) return;
    const N = n();
    const r = Math.floor(i / N);
    const c = i % N;
    for (let k = 0; k < N; k++)
      for (const j of [r * N + k, k * N + c]) {
        if (!(s.cands[j] & (1 << v))) continue;
        s.cands[j] &= ~(1 << v);
        // A cell whose candidates said "a digit" keeps saying so (types with X's only).
        if (!(s.cands[j] & ~RING)) s.cands[j] = g.xPerLine ? RING : 0;
      }
  };

  /**
   * A digit taken out again (erased, or replaced by another) gives back the candidates that
   * placing it removed: those its row and column had just before it went in (the last undo
   * step without it), unless another cell in their lines got the digit since.
   */
  function untidy(before: Snap, s: Snap): void {
    if (!opt.tidy) return;
    const N = n();
    const lines = (j: number) => {
      const r = Math.floor(j / N);
      const c = j % N;
      return Array.from({ length: N }, (_, k) => [r * N + k, k * N + c]).flat();
    };
    for (let i = 0; i < N * N; i++) {
      const v = before.cells[i];
      if (v <= 0 || s.cells[i] === v) continue;
      let k = S.undo.length - 1;
      while (k >= 0 && S.undo[k].cells[i] === v) k--;
      const prev = S.undo[k];
      if (!prev) continue;
      const b = 1 << v;
      for (const j of lines(i)) {
        if (j === i || s.cells[j] !== -1 || !(prev.cands[j] & b) || prev.cands[j] === RING || s.cands[j] & b) continue;
        // (A cell that got the digit since then also took it from j.)
        if (lines(j).some((x) => s.cells[x] === v && prev.cells[x] !== v)) continue;
        s.cands[j] = (s.cands[j] === RING ? 0 : s.cands[j]) | b;
      }
    }
  }

  const pencilOn = () => !noCands && (S.pencil || S.shift || S.sticky);

  /**
   * A digit or X (0) in the selected cells, or a candidate in candidate mode. RING marks the
   * cells "not an X" (an empty ring; with candidates, drops their ✕).
   */
  function enter(v: number, asCandidate = false): void {
    if (!S.p) return;
    if ((v === 0 || v === RING) && !g.xPerLine) return;
    if (v === RING && noCands) return;
    if (!S.selection.size && !noCands) {
      // Nothing selected: mark every cell with this digit, as a value or a candidate.
      if (v > 0 && v !== RING) {
        S.padDigit = S.padDigit === v ? 0 : v;
        ctx.render();
      }
      return;
    }
    const cells = editable();
    if (!cells.length) return;
    if (v === RING) {
      const allRing = cells.every((i) => S.cur.cells[i] < 0 && S.cur.cands[i] === RING);
      return change((s) => {
        for (const i of cells) {
          if (allRing) s.cands[i] = 0;
          else {
            if (s.cells[i] >= 0) s.cells[i] = -1;
            s.cands[i] = s.cands[i] & ~RING & ~1 ? s.cands[i] & ~1 & ~RING : RING;
          }
        }
      });
    }
    if (pencilOn() || (asCandidate && !noCands)) {
      // Candidates (✕ is a note): remove from all if all have it, otherwise add to all.
      const add = !allHaveCand(v);
      return change((s) => setCand(s, v, add));
    }
    const allHave = cells.every((i) => S.cur.cells[i] === v);
    change((s) => {
      for (const i of cells) {
        s.cells[i] = allHave ? -1 : v;
        if (!allHave) tidy(s, i, v);
      }
    });
  }

  /** The open selected cells (where candidates go). */
  const openCells = () => editable().filter((i) => S.cur.cells[i] < 0);
  /** Every open selected cell has candidate v. */
  const allHaveCand = (v: number) => openCells().every((i) => S.cur.cands[i] & (1 << v));
  /** Add (or remove) candidate v in the open selected cells. */
  function setCand(s: Snap, v: number, add: boolean): void {
    const b = 1 << v;
    for (const i of openCells()) {
      const had = s.cands[i];
      const c = add ? (had & ~RING) | b : had & ~RING & ~b;
      // Removing the last candidate of a cell that said "not an X" leaves its ring.
      const saidNotX = !!g.xPerLine && (had === RING || (had & digitMask() && !(had & 1)));
      s.cands[i] = c || (saidNotX ? RING : 0);
    }
  }

  /** Remove every empty ring (they get in the way once the X's are known). */
  function clearRings(): void {
    if (!S.cur.cands.some((c) => c === RING)) return;
    change((s) => s.cands.forEach((c, i) => c === RING && (s.cands[i] = 0)));
    status(t("All rings removed."));
  }

  /** Holding the ring key (pad or keyboard) for HOLD_RING ms clears all rings. */
  const HOLD_RING = 2000;
  let ringTimer = 0;
  const ringKey = () => el("pad").querySelector<HTMLElement>(".dot-key");
  function startRingHold(): void {
    clearTimeout(ringTimer);
    ringKey()?.classList.add("arming");
    ringTimer = window.setTimeout(() => {
      ringKey()?.classList.remove("arming");
      clearRings();
    }, HOLD_RING);
  }
  function stopRingHold(): void {
    clearTimeout(ringTimer);
    ringKey()?.classList.remove("arming");
  }

  function erase(): void {
    if (!S.p) return;
    const cells = editable();
    const hasValue = cells.some((i) => S.cur.cells[i] !== -1);
    change((s) => {
      for (const i of cells) {
        if (hasValue) s.cells[i] = -1;
        else s.cands[i] = 0;
      }
    });
  }

  function undo(): void {
    if (!S.undo.length || S.solved || S.finishing) return;
    S.redo.push(S.cur);
    S.cur = S.undo.pop()!;
    S.wrong.clear();
    S.hint = null;
    ctx.render();
    ctx.save();
  }

  function redo(): void {
    if (!S.redo.length || S.solved || S.finishing) return;
    S.undo.push(S.cur);
    S.cur = S.redo.pop()!;
    afterChange();
  }

  /** Check: your own entries (digits, X's) and rings that sit on an X. */
  function check(): void {
    if (!S.p) return;
    const p = S.p;
    const sol = p.solution;
    S.wrong = new Set(
      S.cur.cells
        .map((v, i) => (!p.givens[i] && ((v >= 0 && v !== sol[i]) || (v < 0 && sol[i] === 0 && S.cur.cands[i] && !(S.cur.cands[i] & 1)))) ? i : -1)
        .filter((i) => i >= 0),
    );
    const mine = S.cur.cells.filter((v, i) => v >= 0 && !p.givens[i]).length;
    if (S.wrong.size) status(t(S.wrong.size === 1 ? "1 cell is not right." : "{n} cells are not right.", { n: S.wrong.size }), "bad");
    else if (!mine) status(t("Nothing filled in yet."));
    else status(t(mine === 1 ? "The one cell you filled in is right." : "All {n} cells you filled in are right.", { n: mine }), "good");
    ctx.render();
  }

  function reveal(): void {
    if (!S.p || S.solved) return;
    const cells = editable().filter((i) => S.cur.cells[i] !== S.p!.solution[i]);
    if (!cells.length) return status(t(editable().length ? "The selected cells are already right." : "Select a cell to reveal."));
    S.hints += cells.length;
    change((s) => cells.forEach((i) => ((s.cells[i] = S.p!.solution[i]), tidy(s, i, S.p!.solution[i]))));
  }

  // ---- Hints ---------------------------------------------------------------------------
  function hint(): void {
    if (!S.p || S.solved || S.finishing) return;
    if (S.hint && S.hint.kind === "step" && S.hintLevel === 1) {
      S.hintLevel = 2;
      return ctx.render();
    }
    S.hint = liteHint(g.solver(S.p), entries(), g.hintToPlacement);
    S.hintLevel = 1;
    if (S.hint.kind === "step") S.hints++;
    S.wrong = S.hint.kind === "error" ? new Set(S.hint.cells) : new Set();
    ctx.setTab("play");
    ctx.render();
  }

  function applyHint(): void {
    const h = S.hint;
    if (!h || h.kind !== "step" || !S.p) return;
    const { step, after } = h;
    const digits = digitMask();
    change((s) => {
      for (const pl of step.placements) {
        s.cells[pl.cell] = pl.value;
        tidy(s, pl.cell, pl.value);
      }
      for (const c of new Set(step.eliminations.map((e) => e.cell))) {
        if (s.cells[c] >= 0) continue;
        const digitsGone = step.eliminations.some((e) => e.cell === c && e.value > 0);
        if (digitsGone) {
          // Write what is left as candidates (with ✕ when it may still be an X).
          const left = after[c] & (digits | (g.xPerLine ? 1 : 0));
          s.cands[c] = left & digits ? left : RING;
        } else if (step.eliminations.some((e) => e.cell === c && e.value === 0)) {
          // Not an X: a ring, or drop the ✕ from the candidates.
          s.cands[c] = s.cands[c] & digits ? s.cands[c] & ~1 & ~RING : RING;
        }
      }
    });
  }
  const snap = (): Snap => ({ cells: S.cur.cells.slice(), cands: S.cur.cands.slice() });
  /** Make the changes since `before` one undo step (with automatic crosses). */
  function commitFrom(before: Snap): void {
    if (JSON.stringify(before) === JSON.stringify(S.cur)) return ctx.render();
    autoDots(before, S.cur);
    pushUndo(before);
    afterChange();
  }

  return { afterChange, allHaveCand, applyHint, autoDots, change, check, commitFrom, editable, enter, erase, hint, pencilOn, pushUndo, redo, reveal, setCand, snap, startRingHold, stopRingHold, undo };
}
