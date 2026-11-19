// The board under the pointer: selecting cells, right-button X's, smart input (Star
// Battle), tapping outside the grid.

import type { LiteCtx } from "./ctx";
import type { LitePuzzle, Snap } from "./types";

export function pointerPart<P extends LitePuzzle>(ctx: LiteCtx<P>) {
  const { g, board, active, opt, S, noCands } = ctx;

  /** The cell an event is on: the cell itself, or (while dragging, when the event stays with the first cell) the one under the pointer. */
  function cellAt(e: PointerEvent, underPointer = false): number {
    const from = underPointer ? (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null) : (e.target as HTMLElement | null);
    const t = from?.closest<HTMLElement>(".lite-cell");
    return t && board.contains(t) ? Number(t.dataset.i) : -1;
  }
  /**
   * Selecting, as in sudoku: a tap selects one cell and dragging adds the cells it passes.
   * Shift (or the S key on a phone) adds cells to the selection; Ctrl, or tapping a selected
   * cell while S is on, takes cells out. The digit highlight follows the first selected cell
   * that holds a digit.
   */
  let drag: "add" | "remove" | null = null;
  const setSelection = (cells: number[]) => {
    if (cells.length) S.padDigit = 0;
    S.selOrder = cells.slice();
    S.selection = new Set(cells);
  };
  const addCell = (i: number) => {
    S.padDigit = 0;
    if (!S.selection.has(i)) S.selOrder.push(i);
    S.selection.add(i);
  };
  const removeCell = (i: number) => {
    S.selOrder = S.selOrder.filter((x) => x !== i);
    S.selection.delete(i);
    if (S.sel === i) S.sel = S.selOrder[S.selOrder.length - 1] ?? i;
  };

  /**
   * Right mouse button (types with X's): X's in the open cells you click or drag across;
   * digits and stars stay. A right-click (no drag) on an X takes it away. One undo step.
   */
  let paint: { start: number; moved: boolean; before: Snap } | null = null;
  let painted = false;
  const paintCell = (i: number) => {
    if (!paint || i < 0 || S.p!.givens[i]) return;
    if (i !== paint.start) paint.moved = true;
    if (S.cur.cells[i] !== -1) return;
    S.cur.cells[i] = 0;
    ctx.render();
  };
  const endPaint = () => {
    if (!paint) return;
    const { before, start, moved } = paint;
    paint = null;
    if (!moved && before.cells[start] === 0) {
      // A plain right-click on an X: take it away.
      S.cur.cells[start] = -1;
      if (noCands) S.cur.cands[start] = 0;
    }
    if (JSON.stringify(before) === JSON.stringify(S.cur)) return;
    ctx.autoDots(before, S.cur);
    ctx.pushUndo(before);
    ctx.afterChange();
  };


  // ---- Smart input (Star Battle, an option) ---------------------------------------------
  // Tap or drag over cells: crosses (stars stay). Double tap (double-click): a star, or takes
  // the star away. Hold, or right-click: clear the cell (right-drag clears every cell passed).
  // With Shift or S held, taps and drags select instead; the star and cross keys fill the
  // selection, and holding or right-clicking inside it clears it. Tapping outside the grid
  // drops the selection. A tapped cell is the (quiet, unmarked) cursor for the keyboard.
  const smartOn = () => !!g.smartInput && opt.smart;
  const HOLD_MS = 450;
  const DOUBLE_MS = 350;
  let sm: { start: number; moved: boolean; held: boolean; erase: boolean; before: Snap; timer: number } | null = null;
  let lastTap: { cell: number; time: number; before: Snap; undoLen: number } | null = null;
  const clearCell = (i: number) => {
    if (S.p!.givens[i]) return;
    S.cur.cells[i] = -1;
    S.cur.cands[i] = 0;
  };
  const crossCell = (i: number) => {
    if (i >= 0 && !S.p!.givens[i] && S.cur.cells[i] === -1) S.cur.cells[i] = 0;
  };
  /** True when cell i is in a selection of several cells (the target of hold and right-click). */
  const inGroup = (i: number) => !S.quiet && S.selection.size > 1 && S.selection.has(i);

  function smartDown(e: PointerEvent, i: number): void {
    e.preventDefault();
    board.focus({ preventScroll: true });
    if (S.solved || S.finishing) return;
    const before = ctx.snap();
    if (e.button === 2) {
      // Right-click: clear this cell, or the whole selection when it is inside one.
      painted = true;
      if (inGroup(i)) {
        S.selection.forEach(clearCell);
        return ctx.commitFrom(before);
      }
      sm = { start: i, moved: false, held: true, erase: true, before, timer: 0 };
      clearCell(i);
      return ctx.render();
    }
    if (!inGroup(i)) {
      setSelection([i]);
      S.quiet = true;
    }
    S.sel = i;
    const timer = window.setTimeout(() => {
      if (!sm || sm.moved) return;
      sm.held = true;
      ctx.cellEls[i]?.classList.remove("holding");
      navigator.vibrate?.(12);
      if (inGroup(i)) S.selection.forEach(clearCell);
      else clearCell(i);
      ctx.commitFrom(sm.before);
    }, HOLD_MS);
    sm = { start: i, moved: false, held: false, erase: false, before, timer };
    ctx.cellEls[i]?.classList.add("holding");
    ctx.render();
  }

  function smartMove(e: PointerEvent): void {
    if (!sm || (sm.held && !sm.erase)) return;
    const j = cellAt(e, true);
    if (j < 0 || (j === sm.start && !sm.moved)) return;
    if (sm.erase) {
      clearCell(j);
      return ctx.render();
    }
    if (!sm.moved) {
      sm.moved = true;
      clearTimeout(sm.timer);
      ctx.cellEls[sm.start]?.classList.remove("holding");
      if (!S.quiet) {
        // Dragging from inside a selection crosses too; the selection goes.
        setSelection([sm.start]);
        S.quiet = true;
      }
      crossCell(sm.start);
    }
    crossCell(j);
    S.sel = j;
    ctx.render();
  }

  function smartUp(): void {
    if (!sm) return;
    const m = sm;
    sm = null;
    clearTimeout(m.timer);
    ctx.cellEls[m.start]?.classList.remove("holding");
    if (m.erase || m.moved) return ctx.commitFrom(m.before);
    if (m.held) return;
    // A tap. The second of two quick taps on a cell: undo the first, toggle a star.
    const i = m.start;
    const now = performance.now();
    if (lastTap && lastTap.cell === i && now - lastTap.time < DOUBLE_MS) {
      const first = lastTap;
      lastTap = null;
      S.cur = { cells: first.before.cells.slice(), cands: first.before.cands.slice() };
      S.undo.length = first.undoLen;
      if (!S.p!.givens[i]) S.cur.cells[i] = first.before.cells[i] === 1 ? -1 : 1;
      if (S.cur.cells[i] === 1) S.cur.cands[i] = 0;
      return ctx.commitFrom(first.before);
    }
    if (inGroup(i)) {
      // A tap inside a selection: just the one cell from now on.
      setSelection([i]);
      S.quiet = true;
    }
    const undoLen = S.undo.length;
    const v = S.cur.cells[i];
    if (!S.p!.givens[i]) {
      if (v === -1) S.cur.cells[i] = 0;
      else if (v === 0) clearCell(i);
    }
    lastTap = { cell: i, time: now, before: m.before, undoLen };
    ctx.commitFrom(m.before);
  }

  // Tapping outside the grid (not on a control) selects nothing, so no shading is in the way.
  document.addEventListener("pointerdown", (e) => {
    if (!active() || !S.p || !S.selection.size) return;
    const t = e.target as HTMLElement;
    if (board.contains(t) || t.closest("button, input, select, textarea, label, a, summary, dialog, .pad")) return;
    setSelection([]);
    if (smartOn()) S.quiet = true;
    ctx.render();
  });

  board.addEventListener("pointerdown", (e) => {
    const i = cellAt(e);
    if (i < 0 || !S.p) return;
    if (smartOn() && !(e.shiftKey || e.ctrlKey || e.metaKey || S.sticky)) return smartDown(e, i);
    S.quiet = false;
    if (e.button === 2) {
      if (!g.xPerLine || S.solved || S.finishing || e.pointerType !== "mouse") return;
      e.preventDefault();
      painted = true;
      setSelection([i]);
      S.sel = i;
      paint = { start: i, moved: false, before: { cells: S.cur.cells.slice(), cands: S.cur.cands.slice() } };
      paintCell(i);
      ctx.render();
      return;
    }
    e.preventDefault();
    board.focus({ preventScroll: true });
    if (e.ctrlKey || e.metaKey || (S.sticky && S.selection.has(i) && S.selection.size > 1)) {
      drag = "remove";
      removeCell(i);
    } else {
      drag = "add";
      if (e.shiftKey || S.sticky) addCell(i);
      else setSelection([i]);
      S.sel = i;
    }
    ctx.render();
  });
  board.addEventListener("pointermove", (e) => {
    if (sm && S.p) return smartMove(e);
    if (paint && S.p) return paintCell(cellAt(e, true));
    if (!drag || !S.p) return;
    const i = cellAt(e, true);
    if (i < 0) return;
    if (drag === "add" && !(S.selection.has(i) && S.sel === i)) {
      addCell(i);
      S.sel = i;
      ctx.render();
    } else if (drag === "remove" && S.selection.has(i) && S.selection.size > 1) {
      removeCell(i);
      ctx.render();
    }
  });
  // A long press on a touch screen puts an X in the cell (the mouse paints X's, above).
  board.addEventListener("contextmenu", (e) => {
    if (!g.xPerLine || !S.p) return;
    e.preventDefault();
    if (painted || paint || smartOn()) return void (painted = false);
    const i = cellAt(e as PointerEvent);
    if (i < 0) return;
    setSelection([i]);
    S.sel = i;
    ctx.enter(0);
  });
  const endDrag = () => {
    drag = null;
    endPaint();
    smartUp();
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  return { addCell, setSelection };
}
