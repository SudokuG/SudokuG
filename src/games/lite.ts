// The page for the lighter puzzle types (Treasure Map, Futoshiki, …): one controller for
// everything they share, laid out like the sudoku page (Play, Puzzles, Options and How to
// play tabs; the code row under the board, or at the bottom on a phone). Each type supplies a
// LiteGame: how to make, rate, encode and draw a puzzle, its board layout, extra marks
// (clue or sign states) and hints.
//
// Cells hold -1 (empty), -2 (a dot: "a digit goes here", types with X's), 0 (an X) or a
// digit. Candidates are bitmasks (bit d; bit 0 is a note for X) shown in the middle of the
// cell, small and framed, in the colour of entered digits.

import { DOT } from "./logic";
import type { LiteHint } from "./logic";
import { LITE_OPTION_TEXT, liteOptions, onLiteOptions, setLiteOption } from "./lite-options";
import { puzzleName } from "../names";
import { currentGame, onGameChange, setGame } from "../ui/games";
import type { GameId } from "../ui/games";
import { openPrintDialog, setCurrentPrint } from "../ui/print-dialog";
import type { PrintPuzzle } from "../ui/print";

export interface LitePuzzle {
  n: number;
  /** The solution, row by row (0 = X for types that have them). */
  solution: number[];
  givens: boolean[];
}

export interface LiteGame<P extends LitePuzzle> {
  id: GameId;
  title: string;
  /** What one puzzle is called in messages ("map", "puzzle"). */
  noun: string;
  sizes: number[];
  defaultSize: number;
  levels: readonly string[];
  /** Digits used on an n×n board (1..maxDigit). */
  maxDigit(n: number): number;
  /** X's per row and column (0: the type has no X's; types with X's also get the dot mark). */
  xPerLine: number;
  /** Rules, as HTML for the "How to play" tab. */
  rules: string;
  /** Code shape shown in the Load box ("J7-…"). */
  codeHint: string;
  /** Make a puzzle of a size and level; yields between tries so the page stays responsive. */
  make(n: number, level: string, rnd: () => number): Generator<number, P>;
  /** The level of a puzzle (for loaded and shared ones). */
  levelOf(p: P): string;
  encode(p: P): string;
  decode(code: string): P;
  isCode(s: string): boolean;
  /** Build the board: call `cell(i)` for each of the n*n cells, in the place it belongs. */
  layout(board: HTMLElement, p: P, cell: (i: number) => HTMLElement): void;
  /** Update marks around the cells (clue states, broken signs); `sel` is the selected cell. */
  decorate(board: HTMLElement, p: P, cells: number[], sel: number): void;
  /** The puzzle as SVG for printing, empty or with entries and candidates. */
  svg(p: P, entries?: number[], cands?: number[]): string;
  /** The next hint for the player's grid. */
  hint(p: P, cells: number[], cands: number[]): LiteHint;
}

/** Ways to reach the site-wide theme setting (it lives with the sudoku settings). */
export interface ThemeHooks {
  get(): string;
  set(theme: string): void;
}

type Snap = { cells: number[]; cands: number[] };
type Tab = "play" | "puzzles" | "options" | "rules";
const TABS: [Tab, string][] = [
  ["play", "Play"],
  ["puzzles", "Puzzles"],
  ["options", "Options"],
  ["rules", "How to play"],
];

const IDLE_MS = 2 * 60 * 1000;
const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function markup<P extends LitePuzzle>(g: LiteGame<P>, theme: boolean): string {
  const id = g.id;
  const codeRow = (cls: string) => `
    <div class="code-row ${cls}">
      <span class="code-label">Puzzle code</span>
      <code data-r="code" class="puzzle-code"></code>
      <button data-r="copy" class="link-btn" type="button">Copy link</button>
      <button data-r="print" class="link-btn" type="button">Print</button>
    </div>`;
  const options = LITE_OPTION_TEXT.map(
    (o) => `<label class="opt"><input data-opt="${o.key}" type="checkbox"> <span><b>${o.title}</b>${o.text ? `<small>${o.text}</small>` : ""}</span></label>`,
  ).join("");
  return `
    <section class="lite-board-wrap">
      <div class="lite-head">
        <span data-r="name" class="puzzle-name"></span>
        <span data-r="label" class="puzzle-label"></span>
        <span data-r="timer" class="timer" aria-label="Time">0:00</span>
      </div>
      <div data-r="board" class="lite-board ${id}-board" role="grid" tabindex="0" aria-label="${esc(g.title)} grid. Arrow keys move, digits enter${g.xPerLine ? ", X places an X, full stop a dot" : ""}."></div>
      ${codeRow("code-row-desktop")}
      <p data-r="status" class="status" aria-live="polite"></p>
    </section>
    <aside class="panel lite-panel">
      <nav class="tabs" role="tablist" aria-label="Panel">
        ${TABS.map(([t, label]) => `<button data-tab="${t}" class="tab" type="button" role="tab">${label}</button>`).join("")}
      </nav>
      <div data-pane="play" class="pane" role="tabpanel">
        <div data-r="solved" class="solved-card" hidden>
          <div class="solved-head"><span class="solved-title">Solved</span><span data-r="solved-time" class="solved-time"></span></div>
          <p data-r="solved-text" class="small"></p>
          <div class="hint-actions"><button data-r="solved-new" class="btn primary" type="button">New puzzle</button></div>
        </div>
        <div data-r="hint-card" class="hint-card" hidden>
          <div class="hint-head">
            <span data-r="hint-tech" class="hint-tech"></span>
            <button data-r="hint-close" class="icon-btn" type="button" aria-label="Close hint">×</button>
          </div>
          <p data-r="hint-text" class="hint-text"></p>
          <div class="hint-actions">
            <button data-r="hint-more" class="btn" type="button">Show the move</button>
            <button data-r="hint-apply" class="btn primary" type="button">Apply</button>
          </div>
        </div>
        <div data-r="pad" class="pad lite-pad" aria-label="Number pad"></div>
        <div class="actions act-edit">
          <button data-r="undo" class="btn" type="button" title="Undo (Ctrl+Z)">Undo</button>
          <button data-r="erase" class="btn" type="button" title="Erase (Backspace)">Erase</button>
          <button data-r="mode" class="btn lite-mode" type="button" aria-pressed="false" title="Candidates (Space, or hold Shift)">Candidates</button>
        </div>
        <div class="actions act-hint">
          <button data-r="hint" class="btn primary wide" type="button" title="Hint (H)">Hint</button>
          <button data-r="check" class="btn" type="button">Check</button>
          <button data-r="reveal" class="btn" type="button" title="Fill in the selected cell">Reveal</button>
        </div>
      </div>
      <div data-pane="puzzles" class="pane" role="tabpanel" hidden>
        <h2 class="pane-title">New ${esc(g.noun)}</h2>
        <span class="small-label">Size</span>
        <div data-r="sizes" class="diff-pick lite-sizes" role="radiogroup" aria-label="Size"></div>
        <span class="small-label">Difficulty</span>
        <div data-r="levels" class="diff-pick lite-levels" role="radiogroup" aria-label="Difficulty"></div>
        <div class="row">
          <button data-r="new" class="btn primary" type="button">New puzzle</button>
          <button data-r="restart" class="btn" type="button">Restart</button>
        </div>
        <div class="print-row">
          <button data-r="print-many" class="link-btn" type="button">Print puzzles</button>
          <span class="small">to solve on paper, or save them as a PDF</span>
        </div>
        <h2 class="pane-title">Load a puzzle</h2>
        <label for="${id}-import" class="small-label">Paste a ${esc(g.title)} code (it looks like ${esc(g.codeHint)})</label>
        <div class="row"><input id="${id}-import" data-r="import" class="code-input" type="text" spellcheck="false" placeholder="${esc(g.codeHint)}"><button data-r="load" class="btn" type="button">Load</button></div>
        <p data-r="load-msg" class="small"></p>
        <details class="info">
          <summary>Your stats</summary>
          <div data-r="stats" class="stats"></div>
        </details>
      </div>
      <div data-pane="options" class="pane" role="tabpanel" hidden>
        ${theme ? `<div class="opt-select"><label for="${id}-theme"><b>Theme</b></label><select id="${id}-theme" data-r="theme"><option value="system">Same as my device</option><option value="light">Light</option><option value="dark">Dark</option></select></div>` : ""}
        <div class="options">${options}</div>
        <p class="small">These options are shared by Treasure Map and Futoshiki; sudoku has its own.</p>
      </div>
      <div data-pane="rules" class="pane" role="tabpanel" hidden>
        <div class="rules small">${g.rules}</div>
        <h2 class="pane-title">Mouse, keyboard and touch</h2>
        <ul class="keys small">
          <li>Tap or click a cell; drag to move the selection. Hold <b>S</b> (on a phone), <kbd>Shift</kbd> or <kbd>Ctrl</kbd> to add cells instead.</li>
          <li>Digits enter digits; with <kbd>Shift</kbd>, <b>S</b> or Candidates on, they toggle small candidates in the middle of the cell.${g.xPerLine ? " <kbd>X</kbd> or <kbd>0</kbd> places an X; <kbd>.</kbd> a dot (a digit goes here)." : ""}</li>
          <li><kbd>H</kbd> hint, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Backspace</kbd> erase, <kbd>Space</kbd> switches candidates on or off, arrow keys move.</li>
        </ul>
      </div>
    </aside>
    ${codeRow("code-row-mobile")}`;
}

/** Set up the page of one puzzle type inside `root` (a <main class="game-view lite">). */
export function initLite<P extends LitePuzzle>(g: LiteGame<P>, root: HTMLElement, theme?: ThemeHooks): void {
  root.innerHTML = markup(g, !!theme);
  const el = (r: string) => root.querySelector<HTMLElement>(`[data-r="${r}"]`)!;
  const all = (r: string) => root.querySelectorAll<HTMLElement>(`[data-r="${r}"]`);
  const btn = (r: string) => el(r) as HTMLButtonElement;
  const SAVE_KEY = `sudokug-${g.id}`;
  const STATS_KEY = `sudokug-${g.id}-stats`;
  const board = el("board");
  const active = () => currentGame() === g.id;
  const opt = liteOptions;

  const S = {
    p: null as P | null,
    code: "",
    level: "",
    pickSize: g.defaultSize,
    pickLevel: g.levels[1] ?? g.levels[0],
    cur: { cells: [], cands: [] } as Snap,
    undo: [] as Snap[],
    sel: 0,
    selection: new Set<number>([0]),
    pencil: false,
    shift: false,
    sticky: false,
    elapsed: 0,
    solved: false,
    hints: 0,
    wrong: new Set<number>(),
    hint: null as LiteHint | null,
    hintLevel: 1,
    lastInput: Date.now(),
    making: false,
    tab: "play" as Tab,
  };
  let cellEls: HTMLElement[] = [];
  const n = () => S.p!.n;
  const maxDigit = () => g.maxDigit(n());
  const nameOf = (code: string, level: string) => puzzleName(code, level, g.id);
  const statsKey = () => `${n()}×${n()} ${S.level}`;

  const status = (msg: string, kind: "" | "good" | "bad" = "") => {
    const s = el("status");
    s.textContent = msg;
    s.className = "status" + (kind ? " " + kind : "");
  };

  // ---- Puzzles ---------------------------------------------------------------------
  function start(p: P, level?: string): void {
    S.p = p;
    S.code = g.encode(p);
    S.level = level ?? g.levelOf(p);
    S.cur = { cells: p.solution.map((v, i) => (p.givens[i] ? v : -1)), cands: new Array(p.n * p.n).fill(0) };
    S.undo = [];
    S.sel = Math.max(0, p.givens.findIndex((x) => !x));
    S.selection = new Set([S.sel]);
    S.elapsed = 0;
    S.solved = false;
    S.hints = 0;
    S.hint = null;
    S.wrong.clear();
    S.lastInput = Date.now();
    buildBoard();
    buildPad();
    status("");
    render();
    save();
  }

  /** Make a new puzzle of the picked size and level, a slice at a time. */
  function make(size: number, level: string, done: (p: P) => void, progress?: () => void): void {
    const it = g.make(size, level, Math.random);
    const step = () => {
      const t0 = performance.now();
      let r = it.next();
      while (!r.done && performance.now() - t0 < 30) r = it.next();
      if (r.done) return done(r.value);
      progress?.();
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  function newPuzzle(): void {
    if (S.making) return;
    S.making = true;
    btn("new").disabled = true;
    status(`Making a ${S.pickLevel.toLowerCase()} ${g.noun}…`);
    make(S.pickSize, S.pickLevel, (p) => {
      S.making = false;
      btn("new").disabled = false;
      start(p, S.pickLevel);
      setTab("play");
    });
  }

  // ---- Saving ------------------------------------------------------------------------
  function save(): void {
    if (!S.p) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, code: S.code, level: S.level, cur: S.cur, elapsed: S.elapsed, solved: S.solved, hints: S.hints, pickSize: S.pickSize, pickLevel: S.pickLevel }));
    } catch {
      /* storage full or unavailable */
    }
  }

  function restore(code?: string): boolean {
    try {
      const f = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
      if (!f || (f.v !== 1 && f.v !== 2) || typeof f.code !== "string") return false;
      if (g.sizes.includes(f.pickSize)) S.pickSize = f.pickSize;
      if (g.levels.includes(f.pickLevel)) S.pickLevel = f.pickLevel;
      if (code && f.code !== code) return false;
      const p = g.decode(f.code);
      const size = p.n * p.n;
      if (!Array.isArray(f.cur?.cells) || f.cur.cells.length !== size || !Array.isArray(f.cur.cands) || f.cur.cands.length !== size) return false;
      start(p, g.levels.includes(f.level) ? f.level : undefined);
      const lo = g.xPerLine ? DOT : -1;
      const hiX = g.xPerLine ? 0 : 1;
      // Never let a saved state change the givens.
      S.cur = {
        cells: f.cur.cells.map((v: number, i: number) => (p.givens[i] ? p.solution[i] : Number.isInteger(v) && v >= lo && v <= g.maxDigit(p.n) && (v < 0 || v >= hiX) ? v : -1)),
        cands: f.cur.cands.map((x: number) => (Number.isInteger(x) ? x : 0)),
      };
      S.elapsed = Math.max(0, Number(f.elapsed) || 0);
      S.solved = !!f.solved;
      S.hints = Number(f.hints) || 0;
      render();
      return true;
    } catch {
      return false;
    }
  }

  // ---- Stats -------------------------------------------------------------------------
  type Stats = Record<string, { solved: number; best: number | null; total: number }>;
  const loadStats = (): Stats => {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") ?? {};
    } catch {
      return {};
    }
  };
  function recordSolve(): string {
    const st = loadStats();
    const key = statsKey();
    const c = (st[key] ??= { solved: 0, best: null, total: 0 });
    c.solved++;
    c.total += S.elapsed;
    let best = false;
    if (!S.hints && (c.best === null || S.elapsed < c.best)) {
      best = c.best !== null;
      c.best = S.elapsed;
    }
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(st));
    } catch {
      /* ignore */
    }
    renderStats();
    const help = S.hints ? `${S.hints} hint${S.hints === 1 ? "" : "s"} or revealed cell${S.hints === 1 ? "" : "s"}` : "no help";
    return [`${key}, ${help}.`, best ? "A new best time!" : c.best !== null ? `Your best: ${fmtTime(c.best)}.` : "", `Solved ${c.solved} of these so far.`].filter(Boolean).join(" ");
  }
  function renderStats(): void {
    const st = loadStats();
    const order = (k: string) => {
      const [size, level] = k.split(" ");
      return parseInt(size, 10) * 10 + g.levels.indexOf(level);
    };
    const rows = Object.keys(st)
      .sort((a, b) => order(a) - order(b))
      .map((k) => `<tr><th scope="row">${esc(k)}</th><td>${st[k].solved}</td><td>${st[k].best === null ? "–" : fmtTime(st[k].best!)}</td><td>${fmtTime(st[k].total / st[k].solved)}</td></tr>`);
    el("stats").innerHTML = rows.length
      ? `<div class="table-wrap"><table class="stats-table"><thead><tr><th></th><th>Solved</th><th>Best</th><th>Average</th></tr></thead><tbody>${rows.join("")}</tbody></table></div><p class="small">Kept in this browser only. Best times count games without hints or revealed cells.</p>`
      : `<p class="small">No puzzles finished yet.</p>`;
  }

  // ---- Editing -----------------------------------------------------------------------
  const editable = () => [...S.selection].filter((i) => !S.p!.givens[i]);

  function change(fn: (s: Snap) => void): void {
    if (S.solved || !S.p) return;
    const before: Snap = { cells: S.cur.cells.slice(), cands: S.cur.cands.slice() };
    fn(S.cur);
    if (JSON.stringify(before) === JSON.stringify(S.cur)) return;
    S.undo.push(before);
    if (S.undo.length > 300) S.undo.shift();
    S.wrong.clear();
    S.hint = null;
    status("");
    if (S.cur.cells.every((v, i) => v === S.p!.solution[i])) {
      S.solved = true;
      el("solved-text").textContent = recordSolve();
      status(`Solved in ${fmtTime(S.elapsed)}.`, "good");
    }
    render();
    save();
  }

  /** Remove digit v from the candidates in the row and column of cell i (when that option is on). */
  const tidy = (s: Snap, i: number, v: number) => {
    if (!opt.tidy || v <= 0) return;
    const N = n();
    const r = Math.floor(i / N);
    const c = i % N;
    for (let k = 0; k < N; k++) {
      s.cands[r * N + k] &= ~(1 << v);
      s.cands[k * N + c] &= ~(1 << v);
    }
  };

  const pencilOn = () => S.pencil || S.shift || S.sticky;

  /** A digit (or X = 0, or a dot) in the selected cells, or a candidate in candidate mode. */
  function enter(v: number): void {
    if (!S.p) return;
    if ((v === 0 || v === DOT) && !g.xPerLine) return;
    const cells = editable();
    if (!cells.length) return;
    if (pencilOn() && v >= 0) {
      // Candidates (✕ is a note): remove from all if all have it, otherwise add to all.
      const b = 1 << v;
      const open = cells.filter((i) => S.cur.cells[i] < 0);
      const allHave = open.every((i) => S.cur.cands[i] & b);
      return change((s) => open.forEach((i) => (s.cands[i] = allHave ? s.cands[i] & ~b : s.cands[i] | b)));
    }
    const allHave = cells.every((i) => S.cur.cells[i] === v);
    change((s) => {
      for (const i of cells) {
        s.cells[i] = allHave ? -1 : v;
        if (!allHave) tidy(s, i, v);
      }
    });
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
    const prev = S.undo.pop();
    if (!prev || S.solved) return;
    S.cur = prev;
    S.wrong.clear();
    S.hint = null;
    render();
    save();
  }

  function check(): void {
    if (!S.p) return;
    const sol = S.p.solution;
    S.wrong = new Set(S.cur.cells.map((v, i) => ((v >= 0 && v !== sol[i]) || (v === DOT && sol[i] === 0) ? i : -1)).filter((i) => i >= 0));
    const filled = S.cur.cells.filter((v) => v >= 0).length;
    status(S.wrong.size ? `${S.wrong.size} cell${S.wrong.size === 1 ? " is" : "s are"} not right.` : `All ${filled} filled cells are right.`, S.wrong.size ? "bad" : "good");
    render();
  }

  function reveal(): void {
    if (!S.p || S.solved) return;
    const cells = editable().filter((i) => S.cur.cells[i] !== S.p!.solution[i]);
    if (!cells.length) return status(editable().length ? "The selected cells are already right." : "Select a cell to reveal.");
    S.hints += cells.length;
    change((s) => cells.forEach((i) => ((s.cells[i] = S.p!.solution[i]), tidy(s, i, S.p!.solution[i]))));
  }

  // ---- Hints ---------------------------------------------------------------------------
  function hint(): void {
    if (!S.p || S.solved) return;
    if (S.hint && S.hint.kind === "step" && S.hintLevel === 1) {
      S.hintLevel = 2;
      return render();
    }
    S.hint = g.hint(S.p, S.cur.cells, S.cur.cands);
    S.hintLevel = 1;
    if (S.hint.kind === "step") S.hints++;
    S.wrong = S.hint.kind === "error" ? new Set(S.hint.cells) : new Set();
    setTab("play");
    render();
  }

  function applyHint(): void {
    const h = S.hint;
    if (!h || h.kind !== "step" || !S.p) return;
    const { step, after } = h;
    change((s) => {
      for (const pl of step.placements) {
        s.cells[pl.cell] = pl.value;
        tidy(s, pl.cell, pl.value);
      }
      const touched = new Set(step.eliminations.map((e) => e.cell));
      for (const c of touched) {
        if (s.cells[c] >= 0) continue;
        // Not an X: mark it with a dot. Digits ruled out: leave the remaining ones as candidates.
        if (step.eliminations.some((e) => e.cell === c && e.value === 0) && s.cells[c] === -1) s.cells[c] = DOT;
        const digits = after[c] & ~1;
        if (step.eliminations.some((e) => e.cell === c && e.value > 0)) s.cands[c] = s.cands[c] & ~1 ? s.cands[c] & (digits | 1) : digits;
      }
    });
  }

  // ---- Rendering ---------------------------------------------------------------------
  /** The cell an event is on: the cell itself, or (while dragging, when the event stays with the first cell) the one under the pointer. */
  function cellAt(e: PointerEvent, underPointer = false): number {
    const from = underPointer ? (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null) : (e.target as HTMLElement | null);
    const t = from?.closest<HTMLElement>(".lite-cell");
    return t && board.contains(t) ? Number(t.dataset.i) : -1;
  }

  function buildBoard(): void {
    board.replaceChildren();
    board.style.setProperty("--n", String(n()));
    cellEls = new Array(n() * n());
    g.layout(board, S.p!, (i) => {
      const cell = document.createElement("div");
      cell.className = "lite-cell";
      cell.dataset.i = String(i);
      cell.setAttribute("role", "gridcell");
      cellEls[i] = cell;
      return cell;
    });
  }

  // Selecting: tap a cell; drag to move the selection; with S, Shift or Ctrl add cells instead.
  let drag: "move" | "add" | null = null;
  board.addEventListener("pointerdown", (e) => {
    const i = cellAt(e);
    if (i < 0 || !S.p) return;
    e.preventDefault();
    board.focus({ preventScroll: true });
    const add = S.sticky || e.shiftKey || e.ctrlKey || e.metaKey;
    drag = add ? "add" : "move";
    if (add) {
      if ((e.ctrlKey || e.metaKey) && S.selection.has(i) && S.selection.size > 1) S.selection.delete(i);
      else S.selection.add(i);
    } else S.selection = new Set([i]);
    S.sel = i;
    render();
  });
  board.addEventListener("pointermove", (e) => {
    if (!drag || !S.p) return;
    const i = cellAt(e, true);
    if (i < 0 || (i === S.sel && S.selection.has(i))) return;
    if (drag === "add") S.selection.add(i);
    else S.selection = new Set([i]);
    S.sel = i;
    render();
  });
  const endDrag = () => (drag = null);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  function buildPad(): void {
    const pad = el("pad");
    const keys: (number | "S")[] = [...Array.from({ length: maxDigit() }, (_, k) => k + 1), ...(g.xPerLine ? [0, DOT] : []), "S"];
    const visible = keys.length - 1; // the S key only shows on phones
    pad.style.setProperty("--keys", String(Math.min(visible, 8)));
    pad.style.setProperty("--keys-phone", String(Math.min(keys.length, 8)));
    pad.replaceChildren(
      ...keys.map((v) => {
        const b = document.createElement("button");
        b.type = "button";
        if (v === "S") {
          b.textContent = "S";
          b.className = "pad-sticky";
          b.title = "Hold to select several cells and enter candidates";
          b.setAttribute("aria-label", "S: select several cells");
          b.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            S.sticky = opt.stickyToggle ? !S.sticky : true;
            render();
          });
          const off = () => {
            if (!opt.stickyToggle && S.sticky) {
              S.sticky = false;
              render();
            }
          };
          b.addEventListener("pointerup", off);
          b.addEventListener("pointercancel", off);
          b.addEventListener("pointerleave", off);
          return b;
        }
        b.textContent = v === 0 ? "✕" : v === DOT ? "•" : String(v);
        b.title = v === 0 ? "X: a cell without a digit (X or 0)" : v === DOT ? "Dot: a digit goes here, not an X (full stop)" : String(v);
        if (v === 0) b.classList.add("x-key");
        if (v === DOT) b.classList.add("dot-key");
        b.addEventListener("click", () => enter(v));
        return b;
      }),
    );
  }

  function render(): void {
    if (!S.p) return;
    const N = n();
    const { cells, cands } = S.cur;
    const sr = Math.floor(S.sel / N);
    const sc = S.sel % N;
    // Repeated digits (or too many X's) in a line.
    const clash = new Set<number>();
    for (let k = 0; k < N; k++)
      for (const idx of [Array.from({ length: N }, (_, c) => k * N + c), Array.from({ length: N }, (_, r) => r * N + k)]) {
        const seen = new Map<number, number[]>();
        for (const i of idx) if (cells[i] >= 0) seen.set(cells[i], [...(seen.get(cells[i]) ?? []), i]);
        for (const [v, at] of seen) if ((v > 0 && at.length > 1) || (v === 0 && at.length > g.xPerLine)) at.forEach((i) => clash.add(i));
      }
    const h = S.hint;
    const step = h?.kind === "step" ? h.step : null;
    const full = !!step && S.hintLevel === 2;
    const region = new Set(step?.region ?? []);
    const targets = new Set(full ? step!.placements.map((x) => x.cell) : []);
    const elims = new Set(full ? step!.eliminations.map((x) => x.cell) : []);
    const selVal = cells[S.sel];
    const multi = S.selection.size > 1;
    for (let i = 0; i < N * N; i++) {
      const c = cellEls[i];
      const v = cells[i];
      const r = Math.floor(i / N);
      const col = i % N;
      c.classList.toggle("given", S.p.givens[i]);
      c.classList.toggle("sel", S.selection.has(i));
      c.classList.toggle("primary", i === S.sel);
      c.classList.toggle("peer", opt.peers && !multi && i !== S.sel && (r === sr || col === sc));
      c.classList.toggle("same", opt.same && i !== S.sel && selVal > 0 && v === selVal);
      c.classList.toggle("x", v === 0);
      c.classList.toggle("wrong", S.wrong.has(i));
      c.classList.toggle("clash", clash.has(i));
      c.classList.toggle("mistake", opt.mistakes && !S.p.givens[i] && ((v >= 0 && v !== S.p.solution[i]) || (v === DOT && S.p.solution[i] === 0)));
      c.classList.toggle("region", region.has(i));
      c.classList.toggle("target", targets.has(i));
      c.classList.toggle("elim", elims.has(i));
      const ds = Array.from({ length: maxDigit() + 1 }, (_, k) => k).filter((d) => cands[i] & (1 << d));
      const pill = ds.length && v < 0 ? `<span class="lite-pill${ds.length > 3 ? " many" : ""}">${ds.map((d) => (d ? d : "✕")).join("")}</span>` : "";
      if (v > 0) c.textContent = String(v);
      else if (v === 0) c.textContent = "✕";
      else if (v === DOT) c.innerHTML = pill ? `${pill}<span class="lite-dot small"></span>` : `<span class="lite-dot"></span>`;
      else c.innerHTML = pill;
      c.setAttribute("aria-label", `Row ${r + 1}, column ${col + 1}: ${v > 0 ? v : v === 0 ? "X" : v === DOT ? "a digit" : "empty"}`);
      c.setAttribute("aria-selected", String(S.selection.has(i)));
    }
    g.decorate(board, S.p, cells, S.sel);
    el("name").textContent = nameOf(S.code, S.level);
    el("label").textContent = `${S.level} · ${N}×${N}`;
    all("code").forEach((x) => (x.textContent = S.code));
    el("timer").hidden = !opt.timer;
    btn("undo").disabled = !S.undo.length || S.solved;
    const mode = el("mode");
    mode.classList.toggle("on", S.pencil);
    mode.setAttribute("aria-pressed", String(S.pencil));
    const pad = el("pad");
    pad.classList.toggle("pad-pencil", pencilOn());
    pad.querySelector(".pad-sticky")?.classList.toggle("on", S.sticky);
    el("solved").hidden = !S.solved;
    el("solved-time").textContent = fmtTime(S.elapsed);
    const what = `${S.pickLevel.toLowerCase()} ${S.pickSize}×${S.pickSize} ${g.noun}`;
    el("solved-new").textContent = `New ${what}`;
    el("new").textContent = `New ${what}`;
    el("print-many").textContent = `Print ${S.pickLevel.toLowerCase()} ${S.pickSize}×${S.pickSize} ${g.noun}s`;
    for (const [r, val] of [["sizes", String(S.pickSize)], ["levels", S.pickLevel]] as const)
      root.querySelectorAll<HTMLButtonElement>(`[data-r=${r}] button`).forEach((b) => {
        const on = b.dataset.v === val;
        b.classList.toggle("on", on);
        b.setAttribute("aria-checked", String(on));
      });
    // Hint card
    const card = el("hint-card");
    card.hidden = !h;
    card.classList.toggle("error", h?.kind === "error");
    if (h) {
      el("hint-tech").textContent = h.kind === "step" ? h.step.technique : h.kind === "error" ? "Something is off" : h.kind === "solved" ? "Solved" : "No hint available";
      el("hint-text").textContent = h.kind === "step" ? (full ? h.step.explanation : h.step.nudge) : h.message;
      el("hint-more").hidden = h.kind !== "step" || full;
      el("hint-apply").hidden = h.kind !== "step" || !full;
    }
  }

  function renderOptions(): void {
    root.querySelectorAll<HTMLInputElement>("[data-opt]").forEach((box) => (box.checked = !!opt[box.dataset.opt as keyof typeof opt]));
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
  }

  // ---- Printing ----------------------------------------------------------------------
  function printPuzzle(p: P, level: string, progress: boolean): PrintPuzzle {
    const code = g.encode(p);
    return {
      givens: [],
      svg: progress ? g.svg(p, S.cur.cells, S.cur.cands) : g.svg(p),
      name: nameOf(code, level),
      difficulty: `${g.title} · ${level} ${p.n}×${p.n}`,
      code,
    };
  }

  function openPrint(many: boolean): void {
    if (!many) {
      if (!S.p) return;
      const progress = S.cur.cells.some((v, i) => v !== -1 && !S.p!.givens[i]) || S.cur.cands.some(Boolean);
      return openPrintDialog({
        title: "Print this puzzle",
        what: `${nameOf(S.code, S.level)} · ${g.title} · ${S.level} ${n()}×${n()}`,
        offerProgress: progress,
        many: false,
        collect: (choice, _msg, done) => done([printPuzzle(S.p!, S.level, choice.progress)]),
      });
    }
    const size = S.pickSize;
    const level = S.pickLevel;
    openPrintDialog({
      title: `Print ${level.toLowerCase()} ${g.title}`,
      what: `New ${level.toLowerCase()} ${size}×${size} ${g.noun}s, made just for this printout.`,
      offerProgress: false,
      many: true,
      collect: (choice, msg, done, run) => {
        const out: PrintPuzzle[] = [];
        const next = () => {
          if (run.cancelled) return;
          if (out.length === choice.count) return done(out);
          msg(`Making ${g.noun}s: ${out.length + 1} of ${choice.count}…`);
          make(size, level, (p) => {
            out.push(printPuzzle(p, level, false));
            next();
          });
        };
        next();
      },
    });
  }

  // ---- Keys, timer, wiring -------------------------------------------------------------
  function move(dr: number, dc: number, extend: boolean): void {
    const N = n();
    S.sel = ((Math.floor(S.sel / N) + dr + N) % N) * N + (((S.sel % N) + dc + N) % N);
    if (extend) S.selection.add(S.sel);
    else S.selection = new Set([S.sel]);
    render();
  }

  function onKey(e: KeyboardEvent): void {
    if (!active() || !S.p) return;
    if (e.key === "Shift" && !S.shift) {
      S.shift = true;
      render();
    }
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || document.querySelector("dialog[open]")) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") {
      e.preventDefault();
      return undo();
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) {
      e.preventDefault();
      return move(...arrows[k], e.shiftKey);
    }
    // Digits by key code, so Shift+digit still works.
    const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code)?.[1];
    if (digit !== undefined) {
      const d = Number(digit);
      if ((d >= 1 && d <= maxDigit()) || (d === 0 && g.xPerLine)) {
        e.preventDefault();
        return enter(d);
      }
    }
    if (g.xPerLine && (k === "x" || k === "X")) {
      e.preventDefault();
      return enter(0);
    }
    if (g.xPerLine && (k === "." || e.code === "NumpadDecimal")) {
      e.preventDefault();
      return enter(DOT);
    }
    if (k === "Backspace" || k === "Delete") {
      e.preventDefault();
      return erase();
    }
    if (k === "h" || k === "H") {
      e.preventDefault();
      return hint();
    }
    if (k === "Escape" && S.hint) {
      S.hint = null;
      return render();
    }
    if (k === " ") {
      e.preventDefault();
      S.pencil = !S.pencil;
      return render();
    }
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

  function copyLink(): void {
    const url = `${location.origin}${location.pathname}#${S.code}`;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => status("Link copied.", "good"), () => status(url));
    else status(url);
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
  picker("sizes", g.sizes.map(String), (v) => `${v}×${v}`, (v) => (S.pickSize = Number(v)));
  picker("levels", [...g.levels], (v) => v, (v) => (S.pickLevel = v));
  root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab as Tab)));
  root.querySelectorAll<HTMLInputElement>("[data-opt]").forEach((box) =>
    box.addEventListener("change", () => setLiteOption(box.dataset.opt as keyof typeof opt, box.checked)),
  );
  onLiteOptions(() => {
    renderOptions();
    if (S.p) render();
  });
  if (theme) el("theme").addEventListener("change", () => theme.set((el("theme") as HTMLSelectElement).value));
  el("new").addEventListener("click", newPuzzle);
  el("solved-new").addEventListener("click", newPuzzle);
  el("restart").addEventListener("click", () => {
    if (!S.p) return;
    start(S.p, S.level);
    status("Restarted.");
    setTab("play");
  });
  el("undo").addEventListener("click", undo);
  el("erase").addEventListener("click", erase);
  el("mode").addEventListener("click", () => {
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
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", (e) => {
    if (e.key === "Shift" && S.shift) {
      S.shift = false;
      if (S.p) render();
    }
  });
  window.addEventListener("blur", () => (S.shift = false));
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && save());
  window.addEventListener("pagehide", save);
  setInterval(() => active() && save(), 15000);
  startTimer();
  renderStats();
  setTab("play");

  const printCurrent = () => (S.p ? { puzzle: printPuzzle(S.p, S.level, false) } : null);
  const show = () => {
    root.classList.add("on");
    setCurrentPrint(printCurrent);
    renderOptions();
    if (!S.p && !restore()) newPuzzle();
    else if (S.p) render();
  };
  onGameChange((id) => {
    if (id === g.id) show();
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
  if (active()) show();
}
