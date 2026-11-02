// The page for the lighter puzzle types (Treasure Map, Futoshiki, …): one controller for
// everything they share, laid out like the sudoku page (Play, Puzzles, Options and How to
// play tabs; the code row under the board, or at the bottom on a phone). Each type supplies a
// LiteGame: how to make, rate, encode and draw a puzzle, its board layout, extra marks
// (clue or sign states) and hints.
//
// Cells hold -1 (empty), -2 (a dot: "a digit goes here", types with X's), 0 (an X) or a
// digit. Candidates are bitmasks (bit d; bit 0 is a note for X) shown in the middle of the
// cell, small and framed, in the colour of entered digits.

import { DOT, RING, liteHint, singlesFinish } from "./logic";
import type { LiteHint, LiteSolver, LiteStep } from "./logic";
import { AUTO_FINISH_CHOICES, LITE_OPTION_TEXT, liteOptions, onLiteOptions, setLiteOption } from "./lite-options";
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
  /** X's per row and column (0: the type has no X's; types with X's also get the ring mark). Star Battle sets 1: its dots are its X's, and its own clash check counts them. */
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
  /** The step-by-step solver (hints, auto-finish). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  solver(p: P): LiteSolver<any>;
  /** Hints go straight to the next value that can be placed (and explain the steps on the way). */
  hintToPlacement: boolean;
  /**
   * Notes per region (Calcudoku: per cage), for working things out: the region of a cell, its
   * name ("12× cage at r1c1"), and regions that get no notes (a given cell).
   */
  notes?: { regionOf(p: P, cell: number): number; name(p: P, k: number): string; skip(p: P, k: number): boolean };
  /** False: no candidates and no ring (Star Battle); the pad and keys only place values. */
  candidates?: boolean;
  /** HTML for a placed value (default: the digit, or ✕ for 0). */
  glyph?(v: number): string;
  /** A value in words, for screen readers and tooltips (default: the digit, or "X"). */
  valueName?(v: number): string;
  /** Extra keys for values ("*" for a star). */
  keyAliases?: Record<string, number>;
  /** Cells to show as clashing (default: a digit twice in a line, too many X's in a line). */
  clashes?(p: P, cells: number[]): Set<number>;
  /**
   * Cells that must be empty given the values entered (Star Battle: around each star, and the
   * rest of full rows, columns and regions); with the "Dot automatically" option they get X's.
   */
  autoMarks?(p: P, cells: number[]): Set<number>;
  /** Solved before every cell is filled in (Star Battle: all the stars are right). */
  isSolved?(p: P, cells: number[]): boolean;
  /** The size as shown on the size buttons (default "8×8"). */
  sizeLabel?(n: number): string;
  /** The "Mouse, keyboard and touch" list items (HTML), instead of the default for digits. */
  controls?: string;
  /** The Techniques tab: rules, then one entry per technique with a worked example. */
  techniques: LiteTechnique[];
  /** Worked examples: technique name -> a puzzle code and the step number (0-based) on its solve. */
  examples: Record<string, { code: string; step: number }>;
}

export interface LiteTechnique {
  /** The technique's name, as the solver's steps call it. */
  name: string;
  idea: string;
  /** Why it is sound (optional, a few sentences). */
  why?: string;
  spot: string;
  /** Shown with candidates (true) or as you'd see it on paper (false: values, X's, rings). */
  candidates: boolean;
}

/** Ways to reach the site-wide theme setting (it lives with the sudoku settings). */
export interface ThemeHooks {
  get(): string;
  set(theme: string): void;
}

type Snap = { cells: number[]; cands: number[] };
type Tab = "play" | "puzzles" | "options" | "techniques";
const TABS: [Tab, string][] = [
  ["play", "Play"],
  ["puzzles", "Puzzles"],
  ["options", "Options"],
  ["techniques", "Techniques"],
];

const IDLE_MS = 2 * 60 * 1000;
const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * Candidates as a small framed pill (in the colour of entered digits); an empty ring for
 * "a digit goes here". `gone` (full hints, examples) strikes candidates that are ruled out.
 */
export function pillHtml(cands: number, max: number, gone = 0, hl = 0): string {
  if (!cands) return "";
  // An empty ring: the same pill as one candidate, with the digit left invisible.
  if (cands === RING) return `<span class="lite-pill ring"><span class="ghost">0</span></span>`;
  const ds = Array.from({ length: max + 1 }, (_, k) => k).filter((d) => cands & (1 << d));
  const cls = (d: number) => (gone & (1 << d) ? ' class="gone"' : hl && d === hl ? ' class="hl"' : "");
  const inner = ds.map((d) => `<span${cls(d)}>${d ? d : "✕"}</span>`).join("");
  return `<span class="lite-pill${ds.length > 3 ? " many" : ""}">${inner}</span>`;
}

/** The rules and the controls, for the Rules entry of the Techniques tab. */
function rulesHtml<P extends LitePuzzle>(g: LiteGame<P>): string {
  const controls =
    g.controls ??
    `<li>Tap or click a cell; drag over cells to select them all. On a phone, hold <b>S</b> and tap or drag to add more cells (the selection and its digit highlight stay); tap a selected cell again to drop it; while S is held, digits go in as candidates. On a computer, <kbd>Shift</kbd> adds cells and <kbd>Ctrl</kbd> toggles them.</li>
      <li>Digits enter digits; with <kbd>Shift</kbd>, <b>S</b> or Candidates on, they toggle small candidates in the middle of the cell. The number pad can always enter candidates (an option).${g.xPerLine ? " <kbd>X</kbd> or <kbd>0</kbd> places an X (or right-click the cell; drag with the right button held to X every open cell you pass, or start on an X to take them away); <kbd>.</kbd> or <kbd>O</kbd> an empty ring (a digit goes here); hold the ring key or <kbd>O</kbd> for 2 seconds to clear all rings. Candidates without ✕ also mean “not an X”; add ✕ to them while it still might be one." : ""}</li>
      <li><kbd>H</kbd> hint, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Backspace</kbd> erase, <kbd>Space</kbd> switches candidates on or off, arrow keys move.</li>`;
  return `${g.rules}
    <h3>Mouse, keyboard and touch</h3>
    <ul class="keys small">
      ${controls}
    </ul>`;
}

function markup<P extends LitePuzzle>(g: LiteGame<P>, theme: boolean): string {
  const id = g.id;
  const codeRow = (cls: string) => `
    <div class="code-row ${cls}">
      <span class="code-label">Puzzle code</span>
      <code data-r="code" class="puzzle-code"></code>
      <button data-r="copy" class="link-btn" type="button">Copy link</button>
      <button data-r="print" class="link-btn" type="button">Print</button>
    </div>`;
  const options = LITE_OPTION_TEXT.filter((o) => (o.for === "candidates" ? g.candidates !== false : o.for === "autoDots" ? !!g.autoMarks : true)).map(
    (o) => `<label class="opt"><input data-opt="${o.key}" type="checkbox"> <span><b>${o.title}</b>${o.text ? `<small>${o.text}</small>` : ""}</span></label>`,
  ).join("");
  return `
    <section class="lite-board-wrap">
      <div data-r="guide" class="lite-guide" hidden>
        <h2 data-r="guide-title" class="guide-title"></h2>
        <div data-r="guide-rules" class="rules guide-text" hidden></div>
        <div data-r="guide-example" hidden>
          <div data-r="guide-board" class="lite-board static ${g.id}-board" aria-hidden="true"></div>
          <div class="guide-text">
            <h3>The idea</h3>
            <p data-r="guide-idea"></p>
            <h3 data-r="guide-why-h">Why it works</h3>
            <p data-r="guide-why"></p>
            <h3>How to spot it</h3>
            <p data-r="guide-spot"></p>
            <h3>In this example</h3>
            <p data-r="guide-step"></p>
            <p class="legend small"><span class="key k-region"></span>where to look <span class="key k-put"></span>what follows <span class="key k-gone"></span>ruled out</p>
          </div>
        </div>
      </div>
      <div class="lite-head">
        <span data-r="name" class="puzzle-name"></span>
        <span data-r="label" class="puzzle-label"></span>
        <span data-r="timer" class="timer" aria-label="Time">0:00</span>
      </div>
      <div data-r="board" class="lite-board ${id}-board" role="grid" tabindex="0" aria-label="${esc(g.title)} grid. Arrow keys move, ${g.candidates === false ? "1 places a star, 0 or X an empty cell" : `digits enter${g.xPerLine ? ", X places an X, O a ring" : ""}`}."></div>
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
          ${g.candidates === false ? "" : `<button data-r="mode" class="btn lite-mode" type="button" aria-pressed="false" title="Candidates (Space, or hold Shift)">Candidates</button>`}
        </div>
        <div class="actions act-hint">
          <button data-r="hint" class="btn primary wide" type="button" title="Hint (H)">Hint</button>
          <button data-r="check" class="btn" type="button">Check</button>
          <button data-r="reveal" class="btn" type="button" title="Fill in the selected cell">Reveal</button>
        </div>
        ${g.notes ? `<section data-r="notes" class="lite-notes" aria-label="Notes"><h2 class="pane-title notes-title">Notes</h2><div data-r="note-list" class="note-list"></div></section>` : ""}
      </div>
      <div data-pane="puzzles" class="pane" role="tabpanel" hidden>
        <div class="type-pick" data-type-pick></div>
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
        <div class="opt-select">
          <label for="${id}-finish"><b>Auto-finish</b></label>
          <select id="${id}-finish" data-r="finish">${AUTO_FINISH_CHOICES.map((k) => `<option value="${k}">${k ? `Last ${k} cells` : "Off"}</option>`).join("")}</select>
          <small>When only this many cells are left, everything you filled in is right, and the rest follows from singles, the puzzle fills itself in.</small>
        </div>
        <p class="small">These options are shared by all puzzle types except sudoku, which has its own.</p>
      </div>
      <div data-pane="techniques" class="pane" role="tabpanel" hidden>
        <div data-r="guide-list" class="guide-list" role="tablist" aria-orientation="vertical" aria-label="Techniques"></div>
      </div>
    </aside>
    ${codeRow("code-row-mobile")}`;
}

/** Set up the page of one puzzle type inside `root` (a <main class="game-view lite">). */
export function initLite<P extends LitePuzzle>(g: LiteGame<P>, root: HTMLElement, theme?: ThemeHooks): void {
  root.innerHTML = markup(g, !!theme);
  const el = (r: string) => root.querySelector<HTMLElement>(`[data-r="${r}"]`)!;
  // (Optional parts, such as the notes, are null when a type doesn't have them.)
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
    finishing: false,
    tab: "play" as Tab,
    /** The entry shown in the Techniques tab. */
    guide: "Rules",
    /** Notes per region (types with notes). */
    notes: {} as Record<number, string>,
    /** The region whose note is being edited. */
    noteFocus: null as number | null,
  };
  let cellEls: HTMLElement[] = [];
  const noCands = g.candidates === false;
  /** A placed value as HTML (a digit, ✕, or the type's own glyph). */
  const show = (v: number) => (g.glyph ? g.glyph(v) : v ? String(v) : "✕");
  const valueName = (v: number) => (g.valueName ? g.valueName(v) : v ? String(v) : "X");
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
    selOrder = [S.sel];
    S.elapsed = 0;
    S.solved = false;
    S.hints = 0;
    S.hint = null;
    S.wrong.clear();
    S.notes = {};
    S.noteFocus = null;
    el("note-list")?.replaceChildren();
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
      if (opt.toPlay) setTab("play");
    });
  }

  // ---- Saving ------------------------------------------------------------------------
  function save(): void {
    if (!S.p) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, code: S.code, level: S.level, cur: S.cur, elapsed: S.elapsed, solved: S.solved, hints: S.hints, pickSize: S.pickSize, pickLevel: S.pickLevel, notes: S.notes }));
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
      const cells: number[] = f.cur.cells.map((v: number, i: number) => (p.givens[i] ? p.solution[i] : Number.isInteger(v) && v >= lo && v <= g.maxDigit(p.n) && (v < 0 || v >= hiX) ? v : -1));
      const cands: number[] = f.cur.cands.map((x: number) => (Number.isInteger(x) ? x : 0));
      // Saves from before the ring: a dot ("a digit goes here") becomes a ring, or drops the ✕ note.
      cells.forEach((v, i) => {
        if (v !== DOT) return;
        cells[i] = -1;
        cands[i] = cands[i] & ~1 & ~RING ? cands[i] & ~1 : RING;
      });
      S.cur = { cells, cands };
      S.elapsed = Math.max(0, Number(f.elapsed) || 0);
      S.solved = !!f.solved;
      S.hints = Number(f.hints) || 0;
      if (f.notes && typeof f.notes === "object")
        for (const [k, t] of Object.entries(f.notes)) if (typeof t === "string" && t) S.notes[Number(k)] = t;
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
  /** Digits of the puzzle as a mask (bits 1..m). */
  const digitMask = () => ((1 << (maxDigit() + 1)) - 1) & ~1;
  const entries = () => ({ n: n(), solution: S.p!.solution, givens: S.p!.givens, cells: S.cur.cells, cands: S.cur.cands, digits: digitMask() });

  function change(fn: (s: Snap) => void): void {
    if (S.solved || !S.p || S.finishing) return;
    const before: Snap = { cells: S.cur.cells.slice(), cands: S.cur.cands.slice() };
    fn(S.cur);
    autoDots(before, S.cur);
    if (JSON.stringify(before) === JSON.stringify(S.cur)) return;
    S.undo.push(before);
    if (S.undo.length > 300) S.undo.shift();
    afterChange();
  }

  /** Marks an X that "Dot automatically" placed (in the candidates, which such types don't use). */
  const AUTO = 1;
  /**
   * "Dot automatically" (types with autoMarks): when a value was added, X the cells that must
   * be empty; X's placed that way go again once nothing requires them (a star taken away).
   */
  function autoDots(before: Snap, s: Snap): void {
    if (!g.autoMarks || !S.p) return;
    s.cells.forEach((v, i) => v !== 0 && s.cands[i] === AUTO && (s.cands[i] = 0));
    if (!opt.autoDots) return;
    const forced = g.autoMarks(S.p, s.cells);
    const added = s.cells.some((v, i) => v > 0 && before.cells[i] !== v);
    if (added) forced.forEach((i) => s.cells[i] === -1 && !S.p!.givens[i] && ((s.cells[i] = 0), (s.cands[i] = AUTO)));
    s.cells.forEach((v, i) => {
      if (v === 0 && s.cands[i] === AUTO && !forced.has(i)) {
        s.cells[i] = -1;
        s.cands[i] = 0;
      }
    });
  }

  function afterChange(): void {
    S.wrong.clear();
    S.hint = null;
    status("");
    const done = g.isSolved ? g.isSolved(S.p!, S.cur.cells) : S.cur.cells.every((v, i) => v === S.p!.solution[i]);
    if (done) {
      // (Star Battle: the cells left open are empty.)
      S.cur.cells.forEach((v, i) => v === -1 && (S.cur.cells[i] = S.p!.solution[i]));
      S.solved = true;
      el("solved-text").textContent = recordSolve();
      status(`Solved in ${fmtTime(S.elapsed)}.`, "good");
    }
    render();
    save();
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
    status("The rest follows from singles: filling it in.");
    let k = 0;
    const tick = () => {
      if (k < order.length && S.p) {
        const { cell, value } = order[k++];
        S.cur.cells[cell] = value;
        cellEls[cell]?.classList.add("pop");
        render();
        return void setTimeout(tick, 110);
      }
      S.finishing = false;
      S.undo.push(before);
      cellEls.forEach((c) => c?.classList.remove("pop"));
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

  const pencilOn = () => !noCands && (S.pencil || S.shift || S.sticky);

  /**
   * A digit or X (0) in the selected cells, or a candidate in candidate mode. RING marks the
   * cells "not an X" (an empty ring; with candidates, drops their ✕).
   */
  function enter(v: number, asCandidate = false): void {
    if (!S.p) return;
    if ((v === 0 || v === RING) && !g.xPerLine) return;
    if (v === RING && noCands) return;
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
      const b = 1 << v;
      const open = cells.filter((i) => S.cur.cells[i] < 0);
      const allHave = open.every((i) => S.cur.cands[i] & b);
      return change((s) =>
        open.forEach((i) => {
          const had = s.cands[i];
          const c = allHave ? had & ~RING & ~b : (had & ~RING) | b;
          // Removing the last candidate of a cell that said "not an X" leaves its ring.
          const saidNotX = !!g.xPerLine && (had === RING || (had & digitMask() && !(had & 1)));
          s.cands[i] = c || (saidNotX ? RING : 0);
        }),
      );
    }
    const allHave = cells.every((i) => S.cur.cells[i] === v);
    change((s) => {
      for (const i of cells) {
        s.cells[i] = allHave ? -1 : v;
        if (!allHave) tidy(s, i, v);
      }
    });
  }

  /** Remove every empty ring (they get in the way once the X's are known). */
  function clearRings(): void {
    if (!S.cur.cands.some((c) => c === RING)) return;
    change((s) => s.cands.forEach((c, i) => c === RING && (s.cands[i] = 0)));
    status("All rings removed.");
  }

  /** Holding the ring key (pad or keyboard) for HOLD_RING ms clears all rings. */
  const HOLD_RING = 2000;
  let ringTimer = 0;
  let ringHeld = false;
  const ringKey = () => el("pad").querySelector<HTMLElement>(".dot-key");
  function startRingHold(): void {
    clearTimeout(ringTimer);
    ringHeld = false;
    ringKey()?.classList.add("arming");
    ringTimer = window.setTimeout(() => {
      ringHeld = true;
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
    const prev = S.undo.pop();
    if (!prev || S.solved || S.finishing) return;
    S.cur = prev;
    S.wrong.clear();
    S.hint = null;
    render();
    save();
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
    if (S.wrong.size) status(`${S.wrong.size} cell${S.wrong.size === 1 ? " is" : "s are"} not right.`, "bad");
    else if (!mine) status("Nothing filled in yet.");
    else status(mine === 1 ? "The one cell you filled in is right." : `All ${mine} cells you filled in are right.`, "good");
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
    if (!S.p || S.solved || S.finishing) return;
    if (S.hint && S.hint.kind === "step" && S.hintLevel === 1) {
      S.hintLevel = 2;
      return render();
    }
    S.hint = liteHint(g.solver(S.p), entries(), g.hintToPlacement);
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

  /**
   * Selecting, as in sudoku: a tap selects one cell and dragging adds the cells it passes.
   * Shift (or the S key on a phone) adds cells to the selection; Ctrl, or tapping a selected
   * cell while S is on, takes cells out. The digit highlight follows the first selected cell
   * that holds a digit.
   */
  let drag: "add" | "remove" | null = null;
  /** The selection in the order it was made. */
  let selOrder: number[] = [0];
  const setSelection = (cells: number[]) => {
    selOrder = cells.slice();
    S.selection = new Set(cells);
  };
  const addCell = (i: number) => {
    if (!S.selection.has(i)) selOrder.push(i);
    S.selection.add(i);
  };
  const removeCell = (i: number) => {
    selOrder = selOrder.filter((x) => x !== i);
    S.selection.delete(i);
    if (S.sel === i) S.sel = selOrder[selOrder.length - 1] ?? i;
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
    render();
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
    autoDots(before, S.cur);
    S.undo.push(before);
    if (S.undo.length > 300) S.undo.shift();
    afterChange();
  };

  board.addEventListener("pointerdown", (e) => {
    const i = cellAt(e);
    if (i < 0 || !S.p) return;
    if (e.button === 2) {
      if (!g.xPerLine || S.solved || S.finishing || e.pointerType !== "mouse") return;
      e.preventDefault();
      painted = true;
      setSelection([i]);
      S.sel = i;
      paint = { start: i, moved: false, before: { cells: S.cur.cells.slice(), cands: S.cur.cands.slice() } };
      paintCell(i);
      render();
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
    render();
  });
  board.addEventListener("pointermove", (e) => {
    if (paint && S.p) return paintCell(cellAt(e, true));
    if (!drag || !S.p) return;
    const i = cellAt(e, true);
    if (i < 0) return;
    if (drag === "add" && !(S.selection.has(i) && S.sel === i)) {
      addCell(i);
      S.sel = i;
      render();
    } else if (drag === "remove" && S.selection.has(i) && S.selection.size > 1) {
      removeCell(i);
      render();
    }
  });
  // A long press on a touch screen puts an X in the cell (the mouse paints X's, above).
  board.addEventListener("contextmenu", (e) => {
    if (!g.xPerLine || !S.p) return;
    e.preventDefault();
    if (painted || paint) return void (painted = false);
    const i = cellAt(e as PointerEvent);
    if (i < 0) return;
    setSelection([i]);
    S.sel = i;
    enter(0);
  });
  const endDrag = () => {
    drag = null;
    endPaint();
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  function setSticky(on: boolean): void {
    S.sticky = on;
    render();
  }

  function buildPad(): void {
    const pad = el("pad");
    const keys: (number | "S")[] = [...Array.from({ length: maxDigit() }, (_, k) => k + 1), ...(g.xPerLine ? (noCands ? [0] : [0, RING]) : []), "S"];
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
          b.title = noCands ? "Hold to select several cells" : "Hold to select several cells and enter candidates";
          b.setAttribute("aria-label", noCands ? "S: select several cells" : "S: select several cells, enter candidates");
          // Held: on while the finger is down. With "S key stays on": tap on, tap off.
          b.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (opt.stickyToggle) return;
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
          b.addEventListener("contextmenu", (e) => e.preventDefault());
          b.addEventListener("click", () => opt.stickyToggle && setSticky(!S.sticky));
          return b;
        }
        if (v === RING) {
          b.innerHTML = `<span class="ring-key" aria-hidden="true"></span>`;
          b.setAttribute("aria-label", "Ring: a digit goes here, not an X");
          b.title = "Ring: a digit goes here, not an X (O or full stop). Hold 2 seconds to clear all rings";
          b.classList.add("dot-key");
        } else {
          b.innerHTML = show(v);
          b.title = g.valueName ? `${valueName(v)} (${v ? "1" : "0 or X"})` : v === 0 ? "X: a cell without a digit (X or 0)" : String(v);
          if (g.valueName) b.setAttribute("aria-label", valueName(v));
          if (v === 0) b.classList.add("x-key");
        }
        // While S is held with one finger, another finger taps the keys: act on pointerdown
        // then (some phones send no click for a second touch) and skip the click that may follow.
        let handledAt = -Infinity;
        b.addEventListener("pointerdown", (e) => {
          handledAt = -Infinity;
          if (v === RING) startRingHold();
          if (!S.sticky || opt.stickyToggle) return;
          handledAt = e.timeStamp;
          enter(v);
        });
        if (v === RING) {
          b.addEventListener("pointerup", stopRingHold);
          b.addEventListener("pointerleave", stopRingHold);
          b.addEventListener("pointercancel", stopRingHold);
          b.addEventListener("contextmenu", (e) => e.preventDefault());
        }
        b.addEventListener("click", (e) => {
          if (v === RING && ringHeld) return void (ringHeld = false);
          if (e.timeStamp - handledAt < 1000) return void (handledAt = -Infinity);
          enter(v);
        });
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
    // Repeated digits (or too many X's) in a line; or the type's own rule.
    const clash = g.clashes ? g.clashes(S.p, cells) : new Set<number>();
    if (!g.clashes)
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
    // The digit to highlight: that of the first selected cell with a digit.
    const hl = selOrder.find((x) => S.selection.has(x) && cells[x] > 0);
    const hlVal = hl === undefined ? 0 : cells[hl];
    const multi = S.selection.size > 1;
    for (let i = 0; i < N * N; i++) {
      const c = cellEls[i];
      const v = cells[i];
      const r = Math.floor(i / N);
      const col = i % N;
      c.classList.toggle("given", S.p.givens[i]);
      c.classList.toggle("sel", S.selection.has(i));
      c.classList.toggle("primary", i === S.sel && S.selection.has(i));
      c.classList.toggle("peer", opt.peers && !multi && i !== S.sel && (r === sr || col === sc));
      c.classList.toggle("same", opt.same && !noCands && hlVal > 0 && v === hlVal && i !== hl);
      // Cells with the highlighted digit among their candidates: a lighter mark, to see patterns.
      const candHl = opt.same && !noCands && hlVal > 0 && v < 0 && cands[i] !== RING && !!(cands[i] & (1 << hlVal));
      c.classList.toggle("cand-same", candHl);
      c.classList.toggle("x", v === 0);
      c.classList.toggle("wrong", S.wrong.has(i));
      c.classList.toggle("clash", clash.has(i));
      const ringOnX = v < 0 && S.p.solution[i] === 0 && cands[i] && !(cands[i] & 1);
      c.classList.toggle("mistake", opt.mistakes && !S.p.givens[i] && ((v >= 0 && v !== S.p.solution[i]) || !!ringOnX));
      c.classList.toggle("region", region.has(i));
      c.classList.toggle("target", targets.has(i));
      c.classList.toggle("elim", elims.has(i));
      if (v >= 0) c.innerHTML = show(v);
      else c.innerHTML = pillHtml(cands[i], maxDigit(), 0, candHl ? hlVal : 0);
      c.setAttribute("aria-label", `Row ${r + 1}, column ${col + 1}: ${v >= 0 ? valueName(v) : cands[i] === RING ? "a digit" : "open"}`);
      c.setAttribute("aria-selected", String(S.selection.has(i)));
    }
    if (g.notes) {
      const nf = S.noteFocus;
      cellEls.forEach((c, i) => c.classList.toggle("note-region", nf !== null && g.notes!.regionOf(S.p!, i) === nf));
      renderNotes();
    }
    g.decorate(board, S.p, cells, S.sel);
    el("name").textContent = nameOf(S.code, S.level);
    el("label").textContent = `${g.title} · ${S.level} · ${N}×${N}`;
    all("code").forEach((x) => (x.textContent = S.code));
    el("timer").hidden = !opt.timer;
    btn("undo").disabled = !S.undo.length || S.solved;
    const mode = root.querySelector<HTMLElement>('[data-r="mode"]');
    mode?.classList.toggle("on", S.pencil);
    mode?.setAttribute("aria-pressed", String(S.pencil));
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

  // ---- Notes (types with regions, e.g. Calcudoku cages) --------------------------------
  /** Show the notes: every region with a note, plus the selected cell's region (an empty field to start one). */
  function renderNotes(): void {
    const nt = g.notes;
    const list = el("note-list");
    if (!nt || !list || !S.p) return;
    const p = S.p;
    const active = nt.regionOf(p, S.sel);
    const want = new Set(Object.keys(S.notes).map(Number).filter((k) => S.notes[k]));
    if (!nt.skip(p, active)) want.add(active);
    if (S.noteFocus !== null) want.add(S.noteFocus);
    const order = [...want].sort((a, b) => a - b);
    const have = new Map([...list.querySelectorAll<HTMLElement>(".note")].map((x) => [Number(x.dataset.k), x]));
    for (const [k, x] of have) if (!want.has(k)) x.remove();
    let prev: HTMLElement | null = null;
    for (const k of order) {
      let x = have.get(k);
      if (!x) {
        x = document.createElement("div");
        x.className = "note";
        x.dataset.k = String(k);
        const id = `${g.id}-note-${k}`;
        x.innerHTML = `<label class="note-name" for="${id}"></label><textarea id="${id}" rows="1" spellcheck="false" placeholder="Notes for this cage…"></textarea>`;
        const ta = x.querySelector("textarea")!;
        const grow = () => {
          ta.style.height = "auto";
          ta.style.height = `${ta.scrollHeight}px`;
        };
        ta.addEventListener("input", () => {
          if (ta.value) S.notes[k] = ta.value;
          else delete S.notes[k];
          grow();
          save();
        });
        ta.addEventListener("focus", () => {
          S.noteFocus = k;
          render();
        });
        ta.addEventListener("blur", () => {
          S.noteFocus = null;
          render();
        });
        ta.value = S.notes[k] ?? "";
        requestAnimationFrame(grow);
      }
      x.querySelector(".note-name")!.textContent = nt.name(p, k);
      x.classList.toggle("active", k === active);
      const ta = x.querySelector("textarea")!;
      if (document.activeElement !== ta && ta.value !== (S.notes[k] ?? "")) ta.value = S.notes[k] ?? "";
      // Keep the order: after the previous note.
      if (prev ? prev.nextElementSibling !== x : list.firstElementChild !== x) {
        if (prev) prev.after(x);
        else list.prepend(x);
      }
      prev = x;
    }
    el("notes").hidden = !order.length;
  }

  function renderOptions(): void {
    root.querySelectorAll<HTMLInputElement>("[data-opt]").forEach((box) => (box.checked = !!opt[box.dataset.opt as keyof typeof opt]));
    (el("finish") as HTMLSelectElement).value = String(opt.autoFinish);
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
    root.classList.toggle("guiding", t === "techniques");
    el("guide").hidden = t !== "techniques";
    if (t === "techniques") showGuide(S.guide);
  }

  // ---- Techniques ----------------------------------------------------------------------
  function buildGuideList(): void {
    const names = ["Rules", ...g.techniques.map((t) => t.name)];
    el("guide-list").replaceChildren(
      ...names.map((name) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "guide-item";
        b.dataset.name = name;
        b.setAttribute("role", "tab");
        b.textContent = name;
        b.addEventListener("click", () => showGuide(name));
        return b;
      }),
    );
  }

  /** Show an entry of the Techniques tab: the rules, or a technique with its worked example. */
  function showGuide(name: string): void {
    S.guide = name;
    root.querySelectorAll<HTMLButtonElement>("[data-r=guide-list] button").forEach((b) => {
      b.classList.toggle("on", b.dataset.name === name);
      b.setAttribute("aria-selected", String(b.dataset.name === name));
    });
    el("guide-title").textContent = name === "Rules" ? `How to play ${g.title}` : name;
    const t = g.techniques.find((x) => x.name === name);
    el("guide-rules").hidden = !!t;
    el("guide-example").hidden = !t;
    if (!t) {
      el("guide-rules").innerHTML = rulesHtml(g);
      return;
    }
    el("guide-idea").textContent = t.idea;
    el("guide-why").textContent = t.why ?? "";
    el("guide-why").hidden = el("guide-why-h").hidden = !t.why;
    el("guide-spot").textContent = t.spot;
    const ex = g.examples[name];
    const shown = ex && drawExample(t, ex);
    el("guide-step").textContent = shown || "No example for this one yet.";
  }

  /** Replay the example's solve to its step and draw the position with the step marked. */
  function drawExample(t: LiteTechnique, ex: { code: string; step: number }): string {
    let p: P;
    try {
      p = g.decode(ex.code);
    } catch {
      return "";
    }
    const solver = g.solver(p);
    const s = solver.start();
    for (let k = 0; k < ex.step; k++) {
      const st = solver.next(s);
      if (!st) return "";
      solver.apply(s, st);
    }
    const step: LiteStep | null = solver.next(s);
    if (!step || step.technique !== t.name) return "";
    const N = p.n;
    const max = g.maxDigit(N);
    const digits = ((1 << (max + 1)) - 1) & ~1;
    const values = s.dom.map((d: number, i: number) => (s.placed[i] ? 31 - Math.clz32(d) : -1));
    const region = new Set(step.region);
    const placed = new Map(step.placements.map((x) => [x.cell, x.value]));
    const gone = new Map<number, number>();
    for (const e of step.eliminations) gone.set(e.cell, (gone.get(e.cell) ?? 0) | (1 << e.value));
    const gb = el("guide-board");
    gb.replaceChildren();
    gb.style.setProperty("--n", String(N));
    const cells: HTMLElement[] = [];
    g.layout(gb, p, (i) => {
      const c = document.createElement("div");
      c.className = "lite-cell";
      cells[i] = c;
      return c;
    });
    cells.forEach((c, i) => {
      c.classList.toggle("given", p.givens[i]);
      c.classList.toggle("region", region.has(i));
      const v = values[i];
      if (placed.has(i)) {
        const pv = placed.get(i)!;
        c.classList.add("target");
        c.innerHTML = show(pv);
        if (!pv) c.classList.add("x");
      } else if (v > 0) c.innerHTML = show(v);
      else if (v === 0) {
        c.innerHTML = show(0);
        c.classList.add("x");
      } else if (t.candidates && region.has(i)) {
        // What is still possible, with what the step rules out struck through.
        const dom = s.dom[i] & (digits | (g.xPerLine ? 1 : 0));
        c.innerHTML = pillHtml(dom, max, gone.get(i) ?? 0);
        if (gone.has(i)) c.classList.add("elim");
      } else if (g.xPerLine && !noCands) {
        // On paper: a ring where it's known there's no X; the step's new rings in green.
        if (gone.has(i) && gone.get(i)! & 1) {
          c.innerHTML = pillHtml(RING, max);
          c.classList.add("target");
        } else if (!(s.dom[i] & 1)) c.innerHTML = pillHtml(RING, max);
      }
    });
    g.decorate(gb, p, values, -1);
    return step.explanation;
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
    if (extend) addCell(S.sel);
    else setSelection([S.sel]);
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
    // Digits by key code, so Shift+digit still works. On Windows, Shift+number pad arrives
    // without shiftKey (as "End", "ArrowDown", …): that counts as Shift too (so this comes
    // before the arrow keys, as in sudoku). With the option, the number pad always enters
    // candidates.
    if (g.keyAliases && k in g.keyAliases) {
      e.preventDefault();
      return enter(g.keyAliases[k]);
    }
    const code = /^(Digit|Numpad)([0-9])$/.exec(e.code);
    if (code) {
      const d = Number(code[2]);
      const numpad = code[1] === "Numpad";
      if ((d >= 1 && d <= maxDigit()) || (d === 0 && g.xPerLine)) {
        e.preventDefault();
        return enter(d, d > 0 && numpad && (opt.numpadCands || !/^[0-9]$/.test(k)));
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
      return enter(0);
    }
    if (g.xPerLine && !noCands && (k === "." || k === "o" || k === "O" || e.code === "NumpadDecimal")) {
      e.preventDefault();
      if (e.repeat) return;
      startRingHold();
      return enter(RING);
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
    if (k === " " && !noCands) {
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
  picker("sizes", g.sizes.map(String), (v) => (g.sizeLabel ? g.sizeLabel(Number(v)) : `${v}×${v}`), (v) => (S.pickSize = Number(v)));
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
  el("finish").addEventListener("change", () => setLiteOption("autoFinish", Number((el("finish") as HTMLSelectElement).value)));
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
  root.querySelector('[data-r="mode"]')?.addEventListener("click", () => {
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
    if (active() && (e.key === "." || e.key === "o" || e.key === "O" || e.code === "NumpadDecimal")) stopRingHold();
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
  buildGuideList();
  setTab("play");

  const printCurrent = () => (S.p ? { puzzle: printPuzzle(S.p, S.level, false) } : null);
  const showPage = () => {
    root.classList.add("on");
    setCurrentPrint(printCurrent);
    renderOptions();
    if (!S.p && !restore()) newPuzzle();
    else if (S.p) render();
  };
  onGameChange((id) => {
    if (id === g.id) showPage();
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
  if (active()) showPage();
}
