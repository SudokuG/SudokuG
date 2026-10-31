// The page for the lighter puzzle types (Treasure Map, Futoshiki, …): one controller for
// everything they share (pad, candidates, undo, Check, Reveal cell, timer, saving, stats,
// links, loading, printing). Each type supplies a LiteGame: how to make, encode and draw a
// puzzle, how to lay out its board, and what extra marks (clue or sign states) to show.
//
// Cells hold -1 (empty), 0 (an X, for types that have them) or a digit. Candidates are
// bitmasks (bit d) and are shown in the middle of the cell, like pairs in sudoku.

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
  /** Board size per difficulty. */
  sizes: Record<string, number>;
  /** Digits used on an n×n board (1..maxDigit). */
  maxDigit(n: number): number;
  /** X's per row and column (0: the type has no X's). */
  xPerLine: number;
  /** Rules, as HTML for the "How to play" box. */
  rules: string;
  /** Code prefix shown in the Load box ("J7-…"). */
  codeHint: string;
  make(difficulty: string, rnd: () => number): P;
  encode(p: P): string;
  decode(code: string): P;
  isCode(s: string): boolean;
  /** Build the board: call `cell(i)` for each of the n*n cells, in the place it belongs. */
  layout(board: HTMLElement, p: P, cell: (i: number) => HTMLElement): void;
  /** Update marks around the cells (clue states, broken signs); `sel` is the selected cell. */
  decorate(board: HTMLElement, p: P, cells: number[], sel: number): void;
  /** The puzzle as SVG for printing, empty or with entries and candidates. */
  svg(p: P, entries?: number[], cands?: number[]): string;
  /** Message while making a puzzle that takes a moment (or "" when it is quick). */
  makingText?(difficulty: string): string;
}

type Snap = { cells: number[]; cands: number[] };

const IDLE_MS = 2 * 60 * 1000;
const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The page markup for one type (built here so all types look and work the same). */
function markup<P extends LitePuzzle>(g: LiteGame<P>): string {
  const id = g.id;
  return `
    <section class="lite-board-wrap">
      <div class="lite-head">
        <span data-r="name" class="puzzle-name"></span>
        <span data-r="label" class="puzzle-label"></span>
        <span data-r="timer" class="timer" aria-label="Time">0:00</span>
      </div>
      <div data-r="board" class="lite-board ${id}-board" role="grid" tabindex="0" aria-label="${esc(g.title)} grid. Arrow keys move, digits enter${g.xPerLine ? ", X marks a blocked cell" : ""}."></div>
      <div class="code-row lite-code">
        <span class="code-label">Puzzle code</span>
        <code data-r="code" class="puzzle-code"></code>
        <button data-r="copy" class="link-btn" type="button">Copy link</button>
        <button data-r="print" class="link-btn" type="button">Print</button>
      </div>
      <p data-r="status" class="status" aria-live="polite"></p>
    </section>
    <aside class="panel lite-panel">
      <div data-r="solved" class="solved-card" hidden>
        <div class="solved-head"><span class="solved-title">Solved</span><span data-r="solved-time" class="solved-time"></span></div>
        <p data-r="solved-text" class="small"></p>
        <div class="hint-actions"><button data-r="solved-new" class="btn primary" type="button">New puzzle</button></div>
      </div>
      <div data-r="pad" class="pad lite-pad" aria-label="Number pad"></div>
      <div class="actions">
        <button data-r="undo" class="btn" type="button" title="Undo (Ctrl+Z)">Undo</button>
        <button data-r="erase" class="btn" type="button" title="Erase (Backspace)">Erase</button>
        <button data-r="mode" class="btn lite-mode" type="button" aria-pressed="false" title="Candidates (Space, or hold Shift)">Candidates</button>
      </div>
      <div class="actions">
        <button data-r="check" class="btn" type="button">Check</button>
        <button data-r="reveal" class="btn" type="button" title="Fill in the selected cell">Reveal cell</button>
      </div>
      <h2 class="pane-title">New puzzle</h2>
      <div data-r="diff" class="diff-pick lite-diff" role="radiogroup" aria-label="Difficulty"></div>
      <div class="row">
        <button data-r="new" class="btn primary" type="button">New puzzle</button>
        <button data-r="restart" class="btn" type="button">Restart</button>
      </div>
      <div class="print-row">
        <button data-r="print-many" class="link-btn" type="button">Print puzzles</button>
        <span class="small">to solve on paper, or save them as a PDF</span>
      </div>
      <details class="info" open>
        <summary>How to play</summary>
        <div class="rules small">${g.rules}</div>
      </details>
      <details class="info">
        <summary>Load a puzzle</summary>
        <label for="${id}-import" class="small-label">Paste a ${esc(g.title)} code (it looks like ${esc(g.codeHint)})</label>
        <div class="row"><input id="${id}-import" data-r="import" class="code-input" type="text" spellcheck="false" placeholder="${esc(g.codeHint)}"><button data-r="load" class="btn" type="button">Load</button></div>
        <p data-r="load-msg" class="small"></p>
      </details>
      <details class="info">
        <summary>Your stats</summary>
        <div data-r="stats" class="stats"></div>
      </details>
    </aside>`;
}

/** Set up the page of one puzzle type inside `root` (a <main class="game-view lite">). */
export function initLite<P extends LitePuzzle>(g: LiteGame<P>, root: HTMLElement): void {
  root.innerHTML = markup(g);
  const el = (r: string) => root.querySelector<HTMLElement>(`[data-r="${r}"]`)!;
  const btn = (r: string) => el(r) as HTMLButtonElement;
  const DIFFS = Object.keys(g.sizes);
  const SAVE_KEY = `sudokug-${g.id}`;
  const STATS_KEY = `sudokug-${g.id}-stats`;
  const board = el("board");
  const active = () => currentGame() === g.id;

  const S = {
    p: null as P | null,
    code: "",
    /** The puzzle's own difficulty (by its size). */
    difficulty: DIFFS[1] ?? DIFFS[0],
    /** The difficulty picked for the next new puzzle. */
    pick: DIFFS[1] ?? DIFFS[0],
    cur: { cells: [], cands: [] } as Snap,
    undo: [] as Snap[],
    sel: 0,
    pencil: false,
    shift: false,
    elapsed: 0,
    solved: false,
    hints: 0,
    wrong: new Set<number>(),
    lastInput: Date.now(),
    making: false,
  };
  let cellEls: HTMLElement[] = [];
  const n = () => S.p!.n;
  const maxDigit = () => g.maxDigit(n());
  const nameOf = (code: string, difficulty: string) => puzzleName(code, difficulty, g.id);
  const difficultyOf = (p: P) => DIFFS.find((d) => g.sizes[d] === p.n) ?? "Other";

  const status = (msg: string, kind: "" | "good" | "bad" = "") => {
    const s = el("status");
    s.textContent = msg;
    s.className = "status" + (kind ? " " + kind : "");
  };

  // ---- Puzzles ---------------------------------------------------------------------
  function start(p: P): void {
    S.p = p;
    S.code = g.encode(p);
    S.difficulty = difficultyOf(p);
    S.cur = { cells: p.solution.map((v, i) => (p.givens[i] ? v : -1)), cands: new Array(p.n * p.n).fill(0) };
    S.undo = [];
    S.sel = Math.max(0, p.givens.findIndex((x) => !x));
    S.elapsed = 0;
    S.solved = false;
    S.hints = 0;
    S.wrong.clear();
    S.lastInput = Date.now();
    buildBoard();
    buildPad();
    status("");
    render();
    save();
  }

  function newPuzzle(): void {
    if (S.making) return;
    S.making = true;
    status(g.makingText?.(S.pick) ?? "");
    setTimeout(() => {
      start(g.make(S.pick, Math.random));
      S.making = false;
    }, 20);
  }

  // ---- Saving ------------------------------------------------------------------------
  function save(): void {
    if (!S.p) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, code: S.code, cur: S.cur, elapsed: S.elapsed, solved: S.solved, hints: S.hints, pick: S.pick }));
    } catch {
      /* storage full or unavailable */
    }
  }

  function restore(code?: string): boolean {
    try {
      const f = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
      if (!f || f.v !== 1 || typeof f.code !== "string" || (code && f.code !== code)) return false;
      const p = g.decode(f.code);
      const size = p.n * p.n;
      if (!Array.isArray(f.cur?.cells) || f.cur.cells.length !== size || !Array.isArray(f.cur.cands) || f.cur.cands.length !== size) return false;
      start(p);
      const lo = g.xPerLine ? 0 : 1;
      // Never let a saved state change the givens.
      S.cur = {
        cells: f.cur.cells.map((v: number, i: number) => (p.givens[i] ? p.solution[i] : Number.isInteger(v) && (v === -1 || (v >= lo && v <= g.maxDigit(p.n))) ? v : -1)),
        cands: f.cur.cands.map((x: number) => (Number.isInteger(x) ? x : 0)),
      };
      S.elapsed = Math.max(0, Number(f.elapsed) || 0);
      S.solved = !!f.solved;
      S.hints = Number(f.hints) || 0;
      if (DIFFS.includes(f.pick)) S.pick = f.pick;
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
    const c = (st[S.difficulty] ??= { solved: 0, best: null, total: 0 });
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
    const help = S.hints ? `${S.hints} cell${S.hints === 1 ? "" : "s"} revealed` : "no help";
    const noun = `${g.noun}${c.solved === 1 ? "" : "s"}`;
    return [`${S.difficulty}, ${help}.`, best ? "A new best time!" : c.best !== null ? `Your best: ${fmtTime(c.best)}.` : "", `Solved ${c.solved} ${S.difficulty.toLowerCase()} ${noun} so far.`].filter(Boolean).join(" ");
  }
  function renderStats(): void {
    const st = loadStats();
    const rows = DIFFS.filter((d) => st[d]).map((d) => `<tr><th scope="row">${d}</th><td>${st[d].solved}</td><td>${st[d].best === null ? "–" : fmtTime(st[d].best!)}</td><td>${fmtTime(st[d].total / st[d].solved)}</td></tr>`);
    el("stats").innerHTML = rows.length
      ? `<div class="table-wrap"><table class="stats-table"><thead><tr><th></th><th>Solved</th><th>Best</th><th>Average</th></tr></thead><tbody>${rows.join("")}</tbody></table></div><p class="small">Kept in this browser only. Best times count games without revealed cells.</p>`
      : `<p class="small">No puzzles finished yet.</p>`;
  }

  // ---- Editing -----------------------------------------------------------------------
  function change(fn: (s: Snap) => void): void {
    if (S.solved || !S.p) return;
    const before: Snap = { cells: S.cur.cells.slice(), cands: S.cur.cands.slice() };
    fn(S.cur);
    if (JSON.stringify(before) === JSON.stringify(S.cur)) return;
    S.undo.push(before);
    if (S.undo.length > 300) S.undo.shift();
    S.wrong.clear();
    status("");
    if (S.cur.cells.every((v, i) => v === S.p!.solution[i])) {
      S.solved = true;
      el("solved-text").textContent = recordSolve();
      status(`Solved in ${fmtTime(S.elapsed)}.`, "good");
    }
    render();
    save();
  }

  /** A digit (or X = 0) in the selected cell, or a candidate in candidate mode. */
  function enter(v: number): void {
    if (!S.p || S.p.givens[S.sel]) return;
    if (v === 0 && !g.xPerLine) return;
    const pencil = (S.pencil || S.shift) && v > 0;
    change((s) => {
      if (pencil) {
        if (s.cells[S.sel] === -1) s.cands[S.sel] ^= 1 << v;
        return;
      }
      s.cells[S.sel] = s.cells[S.sel] === v ? -1 : v;
      // A digit placed removes it from the candidates in its row and column.
      if (v > 0 && s.cells[S.sel] === v) {
        const r = Math.floor(S.sel / n());
        const c = S.sel % n();
        for (let k = 0; k < n(); k++) {
          s.cands[r * n() + k] &= ~(1 << v);
          s.cands[k * n() + c] &= ~(1 << v);
        }
      }
    });
  }

  function erase(): void {
    if (!S.p || S.p.givens[S.sel]) return;
    change((s) => {
      if (s.cells[S.sel] !== -1) s.cells[S.sel] = -1;
      else s.cands[S.sel] = 0;
    });
  }

  function undo(): void {
    const prev = S.undo.pop();
    if (!prev || S.solved) return;
    S.cur = prev;
    S.wrong.clear();
    render();
    save();
  }

  function check(): void {
    if (!S.p) return;
    S.wrong = new Set(S.cur.cells.map((v, i) => (v !== -1 && v !== S.p!.solution[i] ? i : -1)).filter((i) => i >= 0));
    const filled = S.cur.cells.filter((v) => v !== -1).length;
    status(S.wrong.size ? `${S.wrong.size} cell${S.wrong.size === 1 ? " is" : "s are"} not right.` : `All ${filled} filled cells are right.`, S.wrong.size ? "bad" : "good");
    render();
  }

  function reveal(): void {
    if (!S.p || S.solved || S.p.givens[S.sel]) return;
    const v = S.p.solution[S.sel];
    if (S.cur.cells[S.sel] === v) return status("That cell is already right.");
    S.hints++;
    change((s) => (s.cells[S.sel] = v));
  }

  // ---- Rendering ---------------------------------------------------------------------
  function buildBoard(): void {
    board.replaceChildren();
    board.style.setProperty("--n", String(n()));
    cellEls = new Array(n() * n());
    g.layout(board, S.p!, (i) => {
      const cell = document.createElement("div");
      cell.className = "lite-cell";
      cell.setAttribute("role", "gridcell");
      cell.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        S.sel = i;
        board.focus({ preventScroll: true });
        render();
      });
      cellEls[i] = cell;
      return cell;
    });
  }

  function buildPad(): void {
    const pad = el("pad");
    const keys = [...Array.from({ length: maxDigit() }, (_, k) => k + 1), ...(g.xPerLine ? [0] : [])];
    pad.style.setProperty("--keys", String(Math.min(keys.length, 7)));
    pad.replaceChildren(
      ...keys.map((v) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = v ? String(v) : "✕";
        b.title = v ? `${v}` : "X: a blocked cell (X or 0)";
        if (!v) b.classList.add("x-key");
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
        for (const i of idx) if (cells[i] !== -1) seen.set(cells[i], [...(seen.get(cells[i]) ?? []), i]);
        for (const [v, at] of seen) if ((v > 0 && at.length > 1) || (v === 0 && at.length > g.xPerLine)) at.forEach((i) => clash.add(i));
      }
    const selVal = cells[S.sel];
    for (let i = 0; i < N * N; i++) {
      const c = cellEls[i];
      const v = cells[i];
      const r = Math.floor(i / N);
      const col = i % N;
      c.classList.toggle("given", S.p.givens[i]);
      c.classList.toggle("sel", i === S.sel);
      c.classList.toggle("peer", i !== S.sel && (r === sr || col === sc));
      c.classList.toggle("same", i !== S.sel && selVal > 0 && v === selVal);
      c.classList.toggle("x", v === 0);
      c.classList.toggle("wrong", S.wrong.has(i));
      c.classList.toggle("clash", clash.has(i));
      if (v > 0) c.textContent = String(v);
      else if (v === 0) c.textContent = "✕";
      else if (cands[i]) {
        const ds = Array.from({ length: maxDigit() }, (_, k) => k + 1).filter((d) => cands[i] & (1 << d));
        c.innerHTML = `<span class="lite-pill${ds.length > 3 ? " many" : ""}">${ds.join("")}</span>`;
      } else c.textContent = "";
      c.setAttribute("aria-label", `Row ${r + 1}, column ${col + 1}: ${v > 0 ? v : v === 0 ? "X" : "empty"}`);
    }
    g.decorate(board, S.p, cells, S.sel);
    el("name").textContent = nameOf(S.code, S.difficulty);
    el("label").textContent = `${S.difficulty} · ${N}×${N}`;
    el("code").textContent = S.code;
    btn("undo").disabled = !S.undo.length || S.solved;
    const mode = el("mode");
    mode.classList.toggle("on", S.pencil);
    mode.setAttribute("aria-pressed", String(S.pencil));
    el("pad").classList.toggle("pad-pencil", S.pencil || S.shift);
    el("solved").hidden = !S.solved;
    el("solved-time").textContent = fmtTime(S.elapsed);
    el("solved-new").textContent = `New ${S.pick.toLowerCase()} ${g.noun}`;
    el("new").textContent = `New ${S.pick.toLowerCase()} ${g.noun}`;
    el("print-many").textContent = `Print ${S.pick.toLowerCase()} ${g.noun}s`;
    root.querySelectorAll<HTMLButtonElement>("[data-r=diff] button").forEach((b) => {
      const on = b.dataset.d === S.pick;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
    });
  }

  // ---- Printing ----------------------------------------------------------------------
  function printPuzzle(p: P, progress: boolean): PrintPuzzle {
    const code = g.encode(p);
    const difficulty = difficultyOf(p);
    return {
      givens: [],
      svg: progress ? g.svg(p, S.cur.cells, S.cur.cands) : g.svg(p),
      name: nameOf(code, difficulty),
      difficulty: `${g.title} · ${difficulty}`,
      code,
    };
  }

  function openPrint(many: boolean): void {
    if (!many) {
      if (!S.p) return;
      const progress = S.cur.cells.some((v, i) => v !== -1 && !S.p!.givens[i]) || S.cur.cands.some(Boolean);
      return openPrintDialog({
        title: "Print this puzzle",
        what: `${nameOf(S.code, S.difficulty)} · ${g.title} · ${S.difficulty}`,
        offerProgress: progress,
        many: false,
        collect: (choice, _msg, done) => done([printPuzzle(S.p!, choice.progress)]),
      });
    }
    const difficulty = S.pick;
    const size = g.sizes[difficulty];
    openPrintDialog({
      title: `Print ${difficulty.toLowerCase()} ${g.title}`,
      what: `New ${size}×${size} ${g.noun}s, made just for this printout.`,
      offerProgress: false,
      many: true,
      collect: (choice, msg, done, run) => {
        const out: PrintPuzzle[] = [];
        const next = () => {
          if (run.cancelled) return;
          if (out.length === choice.count) return done(out);
          msg(`Making ${g.noun}s: ${out.length + 1} of ${choice.count}…`);
          setTimeout(() => {
            out.push(printPuzzle(g.make(difficulty, Math.random), false));
            next();
          }, 0);
        };
        next();
      },
    });
  }

  // ---- Keys, timer, wiring -------------------------------------------------------------
  function move(dr: number, dc: number): void {
    const N = n();
    S.sel = ((Math.floor(S.sel / N) + dr + N) % N) * N + (((S.sel % N) + dc + N) % N);
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
      return move(...arrows[k]);
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
    if (g.xPerLine && (k === "x" || k === "X" || k === ".")) {
      e.preventDefault();
      return enter(0);
    }
    if (k === "Backspace" || k === "Delete") {
      e.preventDefault();
      return erase();
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

  el("diff").replaceChildren(
    ...DIFFS.map((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.d = d;
      b.setAttribute("role", "radio");
      b.innerHTML = `${d}<small>${g.sizes[d]}×${g.sizes[d]}</small>`;
      b.addEventListener("click", () => {
        S.pick = d;
        save();
        render();
      });
      return b;
    }),
  );
  el("new").addEventListener("click", newPuzzle);
  el("solved-new").addEventListener("click", newPuzzle);
  el("restart").addEventListener("click", () => {
    if (!S.p) return;
    const pick = S.pick;
    start(S.p);
    S.pick = pick;
    render();
    status("Restarted.");
  });
  el("undo").addEventListener("click", undo);
  el("erase").addEventListener("click", erase);
  el("mode").addEventListener("click", () => {
    S.pencil = !S.pencil;
    render();
  });
  el("check").addEventListener("click", check);
  el("reveal").addEventListener("click", reveal);
  el("copy").addEventListener("click", copyLink);
  el("print").addEventListener("click", () => openPrint(false));
  el("print-many").addEventListener("click", () => openPrint(true));
  el("load").addEventListener("click", () => {
    try {
      start(g.decode((el("import") as HTMLInputElement).value.trim()));
      el("load-msg").textContent = "Loaded.";
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

  const printCurrent = () => (S.p ? { puzzle: printPuzzle(S.p, false) } : null);
  const show = () => {
    root.classList.add("on");
    setCurrentPrint(printCurrent);
    if (!S.p && !restore()) newPuzzle();
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
