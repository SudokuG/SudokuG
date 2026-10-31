// Japanese Sums: the page (board, input, checking, timer, saving, stats, links, printing).
// The puzzle logic is in engine.ts. Puzzles are made on the spot when you ask for one.

import { puzzleName } from "../../names";
import { currentGame, onGameChange, setGame } from "../../ui/games";
import { openPrintDialog, setCurrentPrint } from "../../ui/print-dialog";
import type { PrintPuzzle } from "../../ui/print";
import { SUMS_SIZES, decodeSums, encodeSums, generateSums, isSumsCode, runSums } from "./engine";
import type { SumsPuzzle } from "./engine";

const DIFFS = Object.keys(SUMS_SIZES);
const SAVE_KEY = "sudokug-sums";
const STATS_KEY = "sudokug-sums-stats";
const IDLE_MS = 2 * 60 * 1000;

/** -1 = empty, 0 = X, otherwise a digit. */
type Entry = number;
interface Snap {
  cells: Entry[];
  /** Candidate digits per cell (bit d). */
  cands: number[];
}

const S = {
  p: null as SumsPuzzle | null,
  code: "",
  /** The puzzle's own difficulty (by its size). */
  difficulty: "Medium",
  /** The difficulty picked for the next new puzzle. */
  pick: "Medium",
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

const $ = (id: string) => document.getElementById(id)!;
const n = () => S.p!.n;
const m = () => S.p!.n - 2;
const active = () => currentGame() === "sums";

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Puzzles

/**
 * A new puzzle of a difficulty. Medium tries a few grids for one whose clues alone are
 * enough (no given cells, as in the booklets); the others take what they get.
 */
function makePuzzle(difficulty: string, rnd: () => number = Math.random): SumsPuzzle {
  const size = SUMS_SIZES[difficulty] ?? 7;
  let best: SumsPuzzle | null = null;
  for (let k = 0; k < (difficulty === "Medium" ? 12 : 1); k++) {
    const p = generateSums(size, rnd);
    const g = p.givens.filter(Boolean).length;
    if (!best || g < best.givens.filter(Boolean).length) best = p;
    if (!g) break;
  }
  return best!;
}

const difficultyOfSize = (size: number) => DIFFS.find((d) => SUMS_SIZES[d] === size) ?? "Medium";
const nameOf = (code: string, difficulty: string) => puzzleName(code, difficulty, "sums");

function start(p: SumsPuzzle): void {
  S.p = p;
  S.code = encodeSums(p);
  S.difficulty = difficultyOfSize(p.n);
  S.cur = { cells: p.solution.map((v, i) => (p.givens[i] ? v : -1)), cands: new Array(p.n * p.n).fill(0) };
  S.undo = [];
  S.sel = p.givens.findIndex((g) => !g);
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
  status(SUMS_SIZES[S.pick] >= 8 ? "Drawing a new map…" : "");
  // Let the page paint the message first (an 8×8 takes a moment).
  setTimeout(() => {
    start(makePuzzle(S.pick));
    S.making = false;
  }, 20);
}

// ---------------------------------------------------------------------------
// Saving

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
    const p = decodeSums(f.code);
    const size = p.n * p.n;
    if (!Array.isArray(f.cur?.cells) || f.cur.cells.length !== size || !Array.isArray(f.cur.cands) || f.cur.cands.length !== size) return false;
    start(p);
    // Never let a saved state change the givens.
    S.cur = { cells: f.cur.cells.map((v: number, i: number) => (p.givens[i] ? p.solution[i] : Number.isInteger(v) && v >= -1 && v <= p.n - 2 ? v : -1)), cands: f.cur.cands.map((x: number) => (Number.isInteger(x) ? x : 0)) };
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

// ---------------------------------------------------------------------------
// Stats

interface Stats {
  [difficulty: string]: { solved: number; best: number | null; total: number };
}
function loadStats(): Stats {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}
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
  const hints = S.hints ? `${S.hints} cell${S.hints === 1 ? "" : "s"} revealed` : "no help";
  return [`${S.difficulty}, ${hints}.`, best ? "A new best time!" : c.best !== null ? `Your best: ${fmtTime(c.best)}.` : "", `Solved ${c.solved} ${S.difficulty.toLowerCase()} map${c.solved === 1 ? "" : "s"} so far.`].filter(Boolean).join(" ");
}

function renderStats(): void {
  const st = loadStats();
  const rows = DIFFS.filter((d) => st[d]).map((d) => `<tr><th scope="row">${d}</th><td>${st[d].solved}</td><td>${st[d].best === null ? "–" : fmtTime(st[d].best!)}</td><td>${fmtTime(st[d].total / st[d].solved)}</td></tr>`);
  $("sums-stats").innerHTML = rows.length
    ? `<div class="table-wrap"><table class="stats-table"><thead><tr><th></th><th>Solved</th><th>Best</th><th>Average</th></tr></thead><tbody>${rows.join("")}</tbody></table></div><p class="small">Kept in this browser only. Best times count games without revealed cells.</p>`
    : `<p class="small">No puzzles finished yet.</p>`;
}

// ---------------------------------------------------------------------------
// Editing

function change(fn: (s: Snap) => void): void {
  if (S.solved) return;
  const before: Snap = { cells: S.cur.cells.slice(), cands: S.cur.cands.slice() };
  fn(S.cur);
  if (JSON.stringify(before) === JSON.stringify(S.cur)) return;
  S.undo.push(before);
  if (S.undo.length > 300) S.undo.shift();
  S.wrong.clear();
  status("");
  if (S.cur.cells.every((v, i) => v === S.p!.solution[i])) {
    S.solved = true;
    $("sums-solved-text").textContent = recordSolve();
    status(`Solved in ${fmtTime(S.elapsed)}.`, "good");
  }
  render();
  save();
}

/** Enter a digit (1..m) or X (0) in the selected cell, or toggle a candidate. */
function enter(v: number): void {
  if (!S.p || S.p.givens[S.sel]) return;
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

// ---------------------------------------------------------------------------
// Rendering

let cellEls: HTMLDivElement[] = [];
let rowClueEls: HTMLDivElement[] = [];
let colClueEls: HTMLDivElement[] = [];

function buildBoard(): void {
  const board = $("sums-board");
  const N = n();
  board.style.setProperty("--n", String(N));
  board.replaceChildren();
  cellEls = [];
  rowClueEls = [];
  colClueEls = [];
  const corner = document.createElement("div");
  corner.className = "sums-corner";
  board.appendChild(corner);
  for (let c = 0; c < N; c++) {
    const el = document.createElement("div");
    el.className = "sums-clue col";
    el.innerHTML = S.p!.colClues[c].map((x) => `<span>${x}</span>`).join("");
    board.appendChild(el);
    colClueEls.push(el);
  }
  for (let r = 0; r < N; r++) {
    const el = document.createElement("div");
    el.className = "sums-clue row";
    el.innerHTML = S.p!.rowClues[r].map((x) => `<span>${x}</span>`).join("");
    board.appendChild(el);
    rowClueEls.push(el);
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const cell = document.createElement("div");
      cell.className = "sums-cell";
      cell.setAttribute("role", "gridcell");
      if (c % N === N - 1) cell.classList.add("last-col");
      if (r === N - 1) cell.classList.add("last-row");
      cell.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        S.sel = i;
        board.focus({ preventScroll: true });
        render();
      });
      board.appendChild(cell);
      cellEls.push(cell);
    }
  }
}

function buildPad(): void {
  const pad = $("sums-pad");
  pad.style.setProperty("--keys", String(m() + 1));
  pad.replaceChildren(
    ...[...Array.from({ length: m() }, (_, k) => k + 1), 0].map((v) => {
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

/** The state of a line: "done" when complete and right, "bad" when it can't be right. */
function lineState(cells: Entry[], clue: number[]): "" | "done" | "bad" {
  const digits = cells.filter((v) => v > 0);
  const xs = cells.filter((v) => v === 0).length;
  if (new Set(digits).size !== digits.length || xs > 2) return "bad";
  if (cells.includes(-1)) return "";
  const sums = runSums(cells);
  return sums.length === clue.length && sums.every((x, k) => x === clue[k]) ? "done" : "bad";
}

function render(): void {
  if (!S.p) return;
  const N = n();
  const { cells, cands } = S.cur;
  const sr = Math.floor(S.sel / N);
  const sc = S.sel % N;
  // Repeated digits (or a third X) in a line.
  const clash = new Set<number>();
  for (let k = 0; k < N; k++)
    for (const idx of [Array.from({ length: N }, (_, c) => k * N + c), Array.from({ length: N }, (_, r) => r * N + k)]) {
      const seen = new Map<number, number[]>();
      for (const i of idx) if (cells[i] !== -1) seen.set(cells[i], [...(seen.get(cells[i]) ?? []), i]);
      for (const [v, at] of seen) if ((v > 0 && at.length > 1) || (v === 0 && at.length > 2)) at.forEach((i) => clash.add(i));
    }
  const selVal = cells[S.sel];
  for (let i = 0; i < N * N; i++) {
    const el = cellEls[i];
    const v = cells[i];
    const r = Math.floor(i / N);
    const c = i % N;
    el.classList.toggle("given", S.p.givens[i]);
    el.classList.toggle("sel", i === S.sel);
    el.classList.toggle("peer", i !== S.sel && (r === sr || c === sc));
    el.classList.toggle("same", i !== S.sel && selVal > 0 && v === selVal);
    el.classList.toggle("x", v === 0);
    el.classList.toggle("wrong", S.wrong.has(i));
    el.classList.toggle("clash", clash.has(i));
    if (v > 0) el.textContent = String(v);
    else if (v === 0) el.textContent = "✕";
    else if (cands[i]) {
      el.innerHTML = `<span class="sums-cands">${Array.from({ length: m() }, (_, k) => `<span>${cands[i] & (1 << (k + 1)) ? k + 1 : ""}</span>`).join("")}</span>`;
    } else el.textContent = "";
    el.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}: ${v > 0 ? v : v === 0 ? "X" : "empty"}`);
  }
  for (let k = 0; k < N; k++) {
    const row = cells.slice(k * N, k * N + N);
    const col = Array.from({ length: N }, (_, r) => cells[r * N + k]);
    const rs = lineState(row, S.p.rowClues[k]);
    const cs = lineState(col, S.p.colClues[k]);
    rowClueEls[k].className = `sums-clue row${rs ? " " + rs : ""}${k === sr ? " on" : ""}`;
    colClueEls[k].className = `sums-clue col${cs ? " " + cs : ""}${k === sc ? " on" : ""}`;
  }
  const name = nameOf(S.code, S.difficulty);
  $("sums-name").textContent = name;
  $("sums-label").textContent = `${S.difficulty} · ${N}×${N}`;
  $("sums-code").textContent = S.code;
  $("sums-range").textContent = `1 to ${m()}`;
  ($("sums-undo") as HTMLButtonElement).disabled = !S.undo.length || S.solved;
  const mode = $("sums-mode");
  mode.classList.toggle("on", S.pencil);
  mode.setAttribute("aria-pressed", String(S.pencil));
  $("sums-pad").classList.toggle("pad-pencil", S.pencil || S.shift);
  $("sums-solved").hidden = !S.solved;
  $("sums-solved-time").textContent = fmtTime(S.elapsed);
  $("sums-solved-new").textContent = `New ${S.pick.toLowerCase()} puzzle`;
  document.querySelectorAll<HTMLButtonElement>("#sums-diff button").forEach((b) => {
    const on = b.dataset.d === S.pick;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
  $("sums-new").textContent = `New ${S.pick.toLowerCase()} puzzle`;
}

function status(msg: string, kind: "" | "good" | "bad" = ""): void {
  const el = $("sums-status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

// ---------------------------------------------------------------------------
// Printing: the board as SVG, clues around it

/** A puzzle (empty, or with the player's entries) as SVG markup, black on white. */
export function sumsSvg(p: SumsPuzzle, entries?: Entry[], cands?: number[]): string {
  const N = p.n;
  const C = 100; // cell
  // Margin for the clues (left and top): room for the longest row clue and three column clues.
  const longest = Math.max(...p.rowClues.map((rc) => rc.join("  ").length));
  const M = Math.max(130, 30 + longest * 19);
  const W = M + N * C;
  const font = `"Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif`;
  const t: string[] = [];
  for (let k = 0; k < N; k++) {
    const rc = p.rowClues[k];
    t.push(`<text x="${M - 14}" y="${M + k * C + 62}" text-anchor="end" font-size="${rc.length > 2 ? 34 : 38}" font-weight="700" fill="#000">${rc.join("  ")}</text>`);
    const cc = p.colClues[k];
    cc.forEach((x, j) => t.push(`<text x="${M + k * C + 50}" y="${M - 14 - (cc.length - 1 - j) * 34}" text-anchor="middle" font-size="${cc.length > 2 ? 30 : 34}" font-weight="700" fill="#000">${x}</text>`));
  }
  for (let i = 0; i < N * N; i++) {
    const x = M + (i % N) * C + 50;
    const y = M + Math.floor(i / N) * C + 50;
    const given = p.givens[i];
    const v = given ? p.solution[i] : entries ? entries[i] : -1;
    if (v > 0) t.push(`<text x="${x}" y="${y + 22}" text-anchor="middle" font-size="62" font-weight="${given ? 700 : 400}" fill="${given ? "#000" : "#1f4f9e"}">${v}</text>`);
    else if (v === 0) t.push(`<path d="M${x - 24} ${y - 24}L${x + 24} ${y + 24}M${x + 24} ${y - 24}L${x - 24} ${y + 24}" stroke="${given ? "#000" : "#1f4f9e"}" stroke-width="${given ? 9 : 7}" stroke-linecap="round"/>`);
    else if (cands?.[i]) {
      const ds = Array.from({ length: N - 2 }, (_, k) => k + 1).filter((d) => cands[i] & (1 << d));
      for (const d of ds) t.push(`<text x="${x - 30 + ((d - 1) % 3) * 30}" y="${y - 18 + Math.floor((d - 1) / 3) * 34}" text-anchor="middle" font-size="24" fill="#4a4f55">${d}</text>`);
    }
  }
  const lines: string[] = [];
  for (let k = 1; k < N; k++) lines.push(`M${M + k * C} ${M}V${W}M${M} ${M + k * C}H${W}`);
  return `<svg class="pz-grid" viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Japanese Sums puzzle"><rect width="${W}" height="${W}" fill="#fff"/><path d="${lines.join("")}" stroke="#555" stroke-width="3" fill="none"/><rect x="${M}" y="${M}" width="${N * C}" height="${N * C}" stroke="#111" stroke-width="7" fill="none"/><g font-family='${font}'>${t.join("")}</g></svg>`;
}

function printPuzzle(p: SumsPuzzle, difficulty: string, progress: boolean): PrintPuzzle {
  const code = encodeSums(p);
  return {
    givens: [],
    svg: progress ? sumsSvg(p, S.cur.cells, S.cur.cands) : sumsSvg(p),
    name: nameOf(code, difficulty),
    difficulty: `Japanese Sums · ${difficulty}`,
    code,
  };
}

function openPrint(many: boolean): void {
  if (!many) {
    if (!S.p) return;
    const hasProgress = S.cur.cells.some((v, i) => v !== -1 && !S.p!.givens[i]) || S.cur.cands.some(Boolean);
    return openPrintDialog({
      title: "Print this puzzle",
      what: `${nameOf(S.code, S.difficulty)} · ${S.difficulty}`,
      offerProgress: hasProgress,
      many: false,
      collect: (choice, _msg, done) => done([printPuzzle(S.p!, S.difficulty, choice.progress)]),
    });
  }
  const difficulty = S.pick;
  openPrintDialog({
    title: `Print ${difficulty.toLowerCase()} Japanese Sums`,
    what: `New ${SUMS_SIZES[difficulty]}×${SUMS_SIZES[difficulty]} puzzles, made just for this printout.`,
    offerProgress: false,
    many: true,
    collect: (choice, msg, done, run) => {
      const out: PrintPuzzle[] = [];
      const next = () => {
        if (run.cancelled) return;
        if (out.length === choice.count) return done(out);
        msg(`Drawing maps: ${out.length + 1} of ${choice.count}…`);
        setTimeout(() => {
          out.push(printPuzzle(makePuzzle(difficulty), difficulty, false));
          next();
        }, 0);
      };
      next();
    },
  });
}

// ---------------------------------------------------------------------------
// Keys, timer, wiring

function move(dr: number, dc: number): void {
  const N = n();
  const r = (Math.floor(S.sel / N) + dr + N) % N;
  const c = ((S.sel % N) + dc + N) % N;
  S.sel = r * N + c;
  render();
}

function onKey(e: KeyboardEvent): void {
  if (!active() || !S.p) return;
  if (e.key === "Shift") {
    S.shift = true;
    render();
  }
  const t = e.target as HTMLElement;
  if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || (document.querySelector("dialog[open]") && !t.closest(".sums-board"))) return;
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
  // Digits; with Shift, browsers report "!" etc., so use the key code.
  const digit = /^Digit([0-9])$/.exec(e.code)?.[1] ?? /^Numpad([0-9])$/.exec(e.code)?.[1];
  if (digit !== undefined) {
    const d = Number(digit);
    if (d >= 1 && d <= m()) {
      e.preventDefault();
      return enter(d);
    }
    if (d === 0) {
      e.preventDefault();
      return enter(0);
    }
  }
  if (k === "x" || k === "X" || k === ".") {
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
    const el = $("sums-timer");
    el.textContent = fmtTime(S.elapsed);
    el.classList.toggle("paused", playing && !on);
  }, 500);
}

function copyLink(): void {
  const url = `${location.origin}${location.pathname}#${S.code}`;
  const done = () => status("Link copied.", "good");
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => status(url));
  else status(url);
}

export function initSums(): void {
  const diff = $("sums-diff");
  diff.replaceChildren(
    ...DIFFS.map((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.d = d;
      b.setAttribute("role", "radio");
      b.innerHTML = `${d}<small>${SUMS_SIZES[d]}×${SUMS_SIZES[d]}</small>`;
      b.addEventListener("click", () => {
        S.pick = d;
        save();
        render();
      });
      return b;
    }),
  );
  $("sums-new").addEventListener("click", newPuzzle);
  $("sums-solved-new").addEventListener("click", newPuzzle);
  $("sums-restart").addEventListener("click", () => {
    if (!S.p) return;
    start(S.p);
    status("Restarted.");
  });
  $("sums-undo").addEventListener("click", undo);
  $("sums-erase").addEventListener("click", erase);
  $("sums-mode").addEventListener("click", () => {
    S.pencil = !S.pencil;
    render();
  });
  $("sums-check").addEventListener("click", check);
  $("sums-reveal").addEventListener("click", reveal);
  $("sums-copy").addEventListener("click", copyLink);
  $("sums-print").addEventListener("click", () => openPrint(false));
  $("sums-print-many").addEventListener("click", () => openPrint(true));
  $("sums-load").addEventListener("click", () => {
    const text = ($("sums-import") as HTMLInputElement).value.trim();
    try {
      start(decodeSums(text));
      $("sums-load-msg").textContent = "Loaded.";
    } catch (e) {
      $("sums-load-msg").textContent = (e as Error).message;
    }
  });
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", (e) => {
    if (e.key === "Shift" && S.shift) {
      S.shift = false;
      if (S.p) render();
    }
  });
  window.addEventListener("blur", () => {
    S.shift = false;
  });
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && save());
  window.addEventListener("pagehide", save);
  setInterval(() => active() && save(), 15000);
  startTimer();
  renderStats();

  const printCurrent = () => (S.p ? { puzzle: printPuzzle(S.p, S.difficulty, false) } : null);
  onGameChange((g) => {
    if (g !== "sums") return;
    setCurrentPrint(printCurrent);
    if (!S.p && !restore()) newPuzzle();
  });

  // A shared link opens that puzzle (continuing it if it was played here before).
  const hash = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : "";
  if (isSumsCode(hash)) {
    try {
      const p = decodeSums(hash);
      if (!restore(encodeSums(p))) start(p);
      setGame("sums");
      return;
    } catch {
      /* not a valid code: ignore it */
    }
  }
  if (active()) {
    setCurrentPrint(printCurrent);
    if (!restore()) newPuzzle();
  }
}
