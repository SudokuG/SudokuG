// User interface. All sudoku logic lives in ../engine; this file only renders
// the state and turns clicks and keys into state changes.

import {
  ALL,
  DIFFICULTIES,
  Grid,
  Hint,
  PEERS,
  Rating,
  TECHNIQUES,
  bit,
  boxOf,
  colOf,
  countSolutions,
  decodePuzzle,
  digitsOf,
  encodePuzzle,
  generateRated,
  getHint,
  isGrindyStep,
  logicalSolve,
  patternFirst,
  ratePuzzle,
  rowOf,
} from "../engine";
import type { Generated, GenerateProgress, Step } from "../engine";
import { SAMPLES } from "../samples";
import { BoardView, paintBackground, stepDecor } from "./board";
import { initGuide, moveGuide, showGuide } from "./guide-view";

// ---------------------------------------------------------------------------
// State

type Mode = "digit" | "pencil" | "centre" | "color";
const MODES: Mode[] = ["digit", "pencil", "centre", "color"];
const MODE_KEYS: Record<string, Mode> = { z: "digit", x: "pencil", c: "centre", v: "color" };
type Tab = "play" | "puzzles" | "options" | "techniques";
const TABS: Tab[] = ["play", "puzzles", "options", "techniques"];

/** The part of the state that undo/redo tracks. */
interface Snapshot {
  values: number[];
  /** Candidates the player wrote down (used when auto-candidates is off). */
  pencil: number[];
  /** Candidates removed by the player or by hints (used when auto-candidates is on). */
  removed: number[];
  /** "Pairs": small digits written in the centre of a cell. */
  centre: number[];
  /** Cell colours, as a bitmask of colours 1-9. */
  colors: number[];
}

interface Settings {
  theme: "system" | "light" | "dark";
  auto: boolean;
  mistakes: boolean;
  tidy: boolean;
  peers: boolean;
  same: boolean;
  timer: boolean;
  /** Fill in the rest when at most this many cells are left (0 = off). */
  autoFinish: number;
  /** Hints try patterns before triples and quads. */
  patterns: boolean;
  /** Hardest technique that counts as an alternative to a triple or quad (hints and rating). */
  maxAlt: number;
  /** Generator: chosen difficulty and whether one forced triple is allowed. */
  genDifficulty: (typeof DIFFICULTIES)[number];
  genLight: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  auto: false,
  mistakes: false,
  tidy: true,
  peers: true,
  same: true,
  timer: true,
  autoFinish: 10,
  patterns: true,
  maxAlt: 7,
  genDifficulty: "Hard",
  genLight: false,
};

const DIFF_DESC: Record<string, string> = {
  Easy: "Singles only. You can solve it without writing candidates.",
  Medium: "Adds locked candidates and pairs.",
  Hard: "Adds X-Wing, Skyscraper and 2-String Kite.",
  Expert: "Adds XY-Wing, XYZ-Wing, coloring and Swordfish.",
  Extreme: "Adds one- and two-digit chains and Jellyfish.",
};

/** Names for the alternative thresholds offered in Options. */
const ALT_TIERS: Record<number, string> = { 5.5: "Hard", 7: "Expert", 10: "Extreme" };
const SETTINGS_KEY = "pattern-sudoku-settings"; // kept so saved settings survive the rename
const SINGLES = TECHNIQUES.filter((t) => t.level <= 1);

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable: use defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.settings));
  } catch {
    /* ignore */
  }
}

const empty81 = () => new Array(81).fill(0);

const S = {
  puzzle: "",
  label: "",
  givens: [] as boolean[],
  solution: null as number[] | null,
  cur: null as unknown as Snapshot,
  undo: [] as Snapshot[],
  redo: [] as Snapshot[],
  /** Selected cells; `primary` is the cursor (last clicked or moved to). */
  selection: new Set<number>([40]),
  primary: 40,
  mode: "digit" as Mode,
  /** Shift is held: digit mode temporarily enters candidates. */
  shift: false,
  settings: loadSettings(),
  hint: null as Hint | null,
  hintLevel: 1, // 1 = nudge, 2 = full move
  flash: new Set<number>(), // cells marked by Check or by an error hint
  startedAt: Date.now(),
  solvedAt: 0,
  tab: "play" as Tab,
  rating: null as Rating | null,
  code: "",
  /** Auto-finish is filling in cells; input is paused. */
  finishing: false,
  popped: new Set<number>(),
};

const clone = (s: Snapshot): Snapshot => ({
  values: s.values.slice(),
  pencil: s.pencil.slice(),
  removed: s.removed.slice(),
  centre: s.centre.slice(),
  colors: s.colors.slice(),
});

/** The mode a number entry will use right now. */
const effectiveMode = (shiftKey = false): Mode => ((S.shift || shiftKey) && S.mode === "digit" ? "pencil" : S.mode);

/** Candidates implied by the placed digits alone. */
function computed(values: number[], i: number): number {
  if (values[i]) return 0;
  let m = ALL;
  for (const p of PEERS[i]) if (values[p]) m &= ~bit(values[p]);
  return m;
}

/** Candidates shown in the 3×3 candidate grid of a cell. */
function shownCands(i: number): number {
  const { values, pencil, removed } = S.cur;
  if (values[i]) return 0;
  return S.settings.auto ? computed(values, i) & ~removed[i] : pencil[i];
}

/**
 * Candidates the engine reasons with. With auto-candidates on, that is what is shown.
 * Otherwise: a cell where the player wrote candidates uses those (so manual eliminations
 * count); a cell without any uses all possible digits. Pairs (centre marks) restrict too.
 */
function engineCands(i: number): number {
  const { values, pencil, removed, centre } = S.cur;
  if (values[i]) return 0;
  let m = computed(values, i);
  if (!S.settings.auto && pencil[i]) m &= pencil[i];
  else m &= ~removed[i];
  if (centre[i]) m &= centre[i];
  return m;
}

function engineGrid(): Grid {
  return new Grid(S.cur.values, S.cur.values.map((_, i) => engineCands(i)));
}

/** Record the current state for undo, then let `fn` change it. */
function change(fn: (s: Snapshot) => void): boolean {
  const before = clone(S.cur);
  fn(S.cur);
  if (JSON.stringify(before) === JSON.stringify(S.cur)) return false;
  S.undo.push(before);
  if (S.undo.length > 500) S.undo.shift();
  S.redo = [];
  afterChange();
  return true;
}

function afterChange(): void {
  S.hint = null;
  S.flash.clear();
  setStatus("");
  if (!S.solvedAt && S.cur.values.every((v, i) => v && (!S.solution || v === S.solution[i])) && !engineGrid().conflicts().size) {
    S.solvedAt = Date.now();
    setStatus(`Solved in ${fmtTime(S.solvedAt - S.startedAt)}. Nice work.`, "good");
  }
  render();
}

/** Selected cells the player may change (digits and marks; colours work on givens too). */
const editable = () => [...S.selection].filter((i) => !S.givens[i]);

// ---------------------------------------------------------------------------
// Loading puzzles

/** Read a puzzle code or an 81-character puzzle. */
function parsePuzzle(text: string): number[] {
  const clean = text.replace(/\s+/g, "");
  if (clean.length === 81) return Grid.fromString(clean).values;
  if (!clean) throw new Error("Paste a puzzle code or 81 characters first.");
  if (/^[0-9.]+$/.test(clean)) throw new Error(`Expected 81 characters, got ${clean.length}.`);
  return decodePuzzle(clean);
}

/**
 * Load a puzzle from a code or 81-character string. `known` skips the solution
 * search and the rating when the generator already did that work.
 */
function loadPuzzle(text: string, label: string, known?: Generated): string | null {
  let g: Grid;
  try {
    g = new Grid(parsePuzzle(text));
  } catch (e) {
    return (e as Error).message;
  }
  const res = known ? { count: 1, solution: known.solution } : countSolutions(g.values, 2);
  if (res.count === 0) return "This puzzle has no solution. Check for typos.";
  S.puzzle = g.toString();
  S.code = encodePuzzle(g.values);
  S.label = label;
  S.givens = g.values.map((v) => v !== 0);
  S.solution = res.count === 1 ? res.solution : null;
  S.cur = { values: g.values.slice(), pencil: empty81(), removed: empty81(), centre: empty81(), colors: empty81() };
  S.undo = [];
  S.redo = [];
  S.hint = null;
  S.flash.clear();
  S.popped.clear();
  S.selection = new Set([40]);
  S.primary = 40;
  S.startedAt = Date.now();
  S.solvedAt = 0;
  setStatus(res.count === 1 ? "" : "This puzzle has more than one solution, so Check and mistake highlighting are off.", res.count === 1 ? "" : "bad");
  S.rating = known ? known.rating : null;
  renderRating();
  render();
  if (!known) setTimeout(() => rate(g), 30);
  return null;
}

// ---------------------------------------------------------------------------
// Generating

let genRun: { it: Generator<GenerateProgress, Generated>; cancelled: boolean } | null = null;

function startGenerate(): void {
  if (genRun) return;
  const difficulty = S.settings.genDifficulty;
  const it = generateRated({ difficulty, maxGrind: S.settings.genLight ? "light" : "clean", maxAlternative: S.settings.maxAlt });
  const run = { it, cancelled: false };
  genRun = run;
  $("gen-msg").textContent = "Looking for a puzzle…";
  renderGen();
  const step = () => {
    if (run.cancelled) return;
    // Work for up to ~30 ms, then let the page breathe.
    const t0 = performance.now();
    let r = it.next();
    while (!r.done && performance.now() - t0 < 30) r = it.next();
    if (r.done) {
      genRun = null;
      const g = r.value;
      loadPuzzle(g.puzzle.join(""), difficulty, g);
      $("gen-msg").textContent = `New ${difficulty.toLowerCase()} puzzle, found after rating ${g.attempts} candidate${g.attempts === 1 ? "" : "s"}.`;
      renderGen();
      setTab("play");
    } else {
      $("gen-msg").textContent = `Looking for a puzzle… ${r.value.attempts} rated so far.`;
      setTimeout(step, 0);
    }
  };
  setTimeout(step, 0);
}

function cancelGenerate(): void {
  if (!genRun) return;
  genRun.cancelled = true;
  genRun = null;
  $("gen-msg").textContent = "Stopped.";
  renderGen();
}

function renderGen(): void {
  const busy = !!genRun;
  ($("generate") as HTMLButtonElement).disabled = busy;
  $("generate").textContent = busy ? "Generating…" : `Generate ${S.settings.genDifficulty.toLowerCase()} puzzle`;
  $("gen-cancel").hidden = !busy;
  document.querySelectorAll<HTMLButtonElement>("#diff-pick button").forEach((b) => {
    const on = b.dataset.d === S.settings.genDifficulty;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
  $("diff-desc").textContent = DIFF_DESC[S.settings.genDifficulty];
  ($("gen-light") as HTMLInputElement).checked = S.settings.genLight;
}

function rate(g: Grid): void {
  S.rating = ratePuzzle(g, S.settings.maxAlt);
  renderRating();
}

const GRIND_TEXT = {
  clean: "Clean",
  light: "Slightly grindy",
  heavy: "Grindy",
};

function renderRating(): void {
  const el = $("rating");
  const r = S.rating;
  if (!r) {
    el.textContent = "Rating…";
    return;
  }
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tier = ALT_TIERS[S.settings.maxAlt] ?? "Expert";
  const rows: string[] = [];
  if (r.solved) {
    rows.push(`<dt>Difficulty</dt><dd><span class="badge diff-${r.difficulty.toLowerCase()}">${r.difficulty}</span> Hardest step: ${esc(r.hardest?.technique ?? "singles only")}.</dd>`);
  } else {
    rows.push(`<dt>Difficulty</dt><dd><span class="badge diff-beyond">Beyond</span> The current techniques get stuck, so this puzzle can't be fully rated yet.</dd>`);
  }
  let grind = `<span class="badge grind-${r.grind}">${GRIND_TEXT[r.grind]}</span> `;
  if (!r.forced.length) {
    grind += r.grindOnEasiestPath
      ? `A triple, quad or long chain shows up, but there is always a pattern up to ${tier} level that works instead` +
        (r.hardestPatternFirst && r.hardestPatternFirst.level > (r.hardest?.level ?? 0)
          ? ` (the hardest one you'd need is ${esc(r.hardestPatternFirst.technique)}).`
          : ".")
      : `No triples, quads or long chains needed.`;
  } else {
    const list = r.forced.map((f) =>
      f.kind === "subset"
        ? `${f.technique} in ${f.where} (${f.emptyInUnit} empty cells, step ${f.step})`
        : `${f.technique} with ${f.digits} digits (step ${f.step})`,
    );
    grind += `${r.forced.length === 1 ? "Once" : `${r.forced.length} times`}, a triple, quad or long chain was the only way forward: ${esc(list.join("; "))}.`;
  }
  rows.push(`<dt>Grind</dt><dd>${grind}</dd>`);
  const used = r.used.map((u) => `${u.technique} ×${u.count}`);
  rows.push(`<dt>Solve path</dt><dd>${r.steps} steps, easiest move first: ${esc(used.join(", ") || "none")}.</dd>`);
  el.innerHTML = `<dl class="rating-list">${rows.join("")}</dl>`;
}

// ---------------------------------------------------------------------------
// Actions

/** Toggle bit `b` in `masks` for `cells`: remove it everywhere if all have it, else add it everywhere. */
function toggleAll(masks: number[], cells: number[], b: number, has: (i: number) => boolean): void {
  const allHave = cells.every(has);
  for (const i of cells) masks[i] = allHave ? masks[i] & ~b : masks[i] | b;
}

function enterNumber(d: number, mode: Mode = effectiveMode()): void {
  if (S.finishing) return;
  if (mode === "color") {
    const cells = [...S.selection];
    if (!cells.length) return;
    change((s) => toggleAll(s.colors, cells, bit(d), (i) => !!(S.cur.colors[i] & bit(d))));
    return;
  }
  const cells = editable();
  if (!cells.length) return;
  const empty = cells.filter((i) => !S.cur.values[i]);
  if (mode === "pencil") {
    if (!empty.length) return;
    const allHave = empty.every((i) => shownCands(i) & bit(d));
    change((s) => {
      for (const i of empty) {
        if (S.settings.auto) {
          if (allHave) s.removed[i] |= bit(d);
          else s.removed[i] &= ~bit(d);
        } else if (allHave) s.pencil[i] &= ~bit(d);
        else s.pencil[i] |= bit(d);
      }
    });
  } else if (mode === "centre") {
    if (!empty.length) return;
    change((s) => toggleAll(s.centre, empty, bit(d), (i) => !!(S.cur.centre[i] & bit(d))));
  } else {
    const allSame = cells.every((i) => S.cur.values[i] === d);
    const changed = change((s) => {
      for (const i of cells) {
        if (allSame) s.values[i] = 0;
        else {
          s.values[i] = d;
          if (S.settings.tidy)
            for (const p of PEERS[i]) {
              s.pencil[p] &= ~bit(d);
              s.centre[p] &= ~bit(d);
            }
        }
      }
    });
    if (changed && !allSame) maybeAutoFinish();
  }
}

/** Backspace: digits first, then candidates and pairs, then colours. In Colour mode, colours first. */
function erase(): void {
  if (S.finishing) return;
  const sel = [...S.selection];
  const cells = editable();
  const anyColor = sel.some((i) => S.cur.colors[i]);
  const clearColors = (s: Snapshot) => sel.forEach((i) => (s.colors[i] = 0));
  if (S.mode === "color" && anyColor) return void change(clearColors);
  const anyValue = cells.some((i) => S.cur.values[i]);
  const anyMarks = cells.some((i) => !S.cur.values[i] && (S.cur.pencil[i] || S.cur.removed[i] || S.cur.centre[i]));
  change((s) => {
    if (anyValue) cells.forEach((i) => (s.values[i] = 0));
    else if (anyMarks)
      cells.forEach((i) => {
        s.pencil[i] = 0;
        s.removed[i] = 0;
        s.centre[i] = 0;
      });
    else if (anyColor) clearColors(s);
  });
}

function clearColorsOfSelection(): void {
  change((s) => S.selection.forEach((i) => (s.colors[i] = 0)));
}

function doUndo(): void {
  if (S.finishing) return;
  const prev = S.undo.pop();
  if (!prev) return;
  S.redo.push(clone(S.cur));
  S.cur = prev;
  afterChange();
}

function doRedo(): void {
  if (S.finishing) return;
  const next = S.redo.pop();
  if (!next) return;
  S.undo.push(clone(S.cur));
  S.cur = next;
  afterChange();
}

/** Write every possible candidate into the empty cells (manual mode). */
function fillCandidates(): void {
  change((s) => {
    for (let i = 0; i < 81; i++) s.pencil[i] = s.values[i] ? 0 : computed(s.values, i) & ~s.removed[i];
  });
}

/** Wipe all candidates and pairs. Turns auto-candidates off, since it would otherwise show them again. */
function clearCandidates(): void {
  if (S.settings.auto) {
    S.settings.auto = false;
    saveSettings();
  }
  change((s) => {
    s.pencil.fill(0);
    s.removed.fill(0);
    s.centre.fill(0);
  });
  render();
}

function setAuto(on: boolean): void {
  if (on === S.settings.auto) return;
  change((s) => {
    if (on) {
      // Keep the player's own eliminations: anything not written down counts as removed.
      for (let i = 0; i < 81; i++) if (!s.values[i] && s.pencil[i]) s.removed[i] = computed(s.values, i) & ~s.pencil[i];
    } else {
      // Turning auto-candidates off wipes the automatic candidates.
      s.pencil.fill(0);
      s.removed.fill(0);
    }
  });
  S.settings.auto = on;
  saveSettings();
  S.hint = null;
  render();
}

/**
 * Auto-finish: when few cells are left, every digit so far is correct and the rest
 * follows from singles alone, fill in the rest one by one (as a single undo step).
 */
function maybeAutoFinish(): void {
  const limit = S.settings.autoFinish;
  if (!limit || !S.solution || S.finishing) return;
  const values = S.cur.values;
  const left = values.filter((v) => !v).length;
  if (!left || left > limit) return;
  if (values.some((v, i) => v && v !== S.solution![i])) return;
  const log = logicalSolve(new Grid(values), SINGLES);
  if (!log.solved) return;
  const order = log.steps.flatMap((s) => s.placements);

  S.undo.push(clone(S.cur));
  S.redo = [];
  S.finishing = true;
  S.hint = null;
  const fast = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let k = 0;
  const tick = () => {
    const p = order[k++];
    S.cur.values[p.cell] = p.digit;
    S.popped.add(p.cell);
    render();
    if (k < order.length) setTimeout(tick, fast ? 0 : 80);
    else {
      S.finishing = false;
      afterChange();
      if (S.solvedAt) setStatus(`Solved in ${fmtTime(S.solvedAt - S.startedAt)}. The last ${order.length} cells were filled in for you.`, "good");
      setTimeout(() => {
        S.popped.clear();
        render();
      }, 600);
    }
  };
  setTimeout(tick, fast ? 0 : 150);
}

function showHint(): void {
  if (S.finishing) return;
  if (S.hint && S.hint.kind === "step" && S.hintLevel === 1) {
    S.hintLevel = 2;
  } else {
    S.hint = getHint(engineGrid(), S.solution, S.settings.patterns ? patternFirst(S.settings.maxAlt) : TECHNIQUES);
    S.hintLevel = 1;
    S.flash.clear();
    if (S.hint.kind === "error") S.hint.cells.forEach((c) => S.flash.add(c));
  }
  if (S.tab !== "play") setTab("play");
  render();
}

function applyHint(): void {
  if (!S.hint || S.hint.kind !== "step") return;
  const step = S.hint.step;
  change((s) => {
    for (const e of step.eliminations) {
      s.removed[e.cell] |= bit(e.digit);
      s.pencil[e.cell] &= ~bit(e.digit);
      s.centre[e.cell] &= ~bit(e.digit);
    }
    for (const p of step.placements) {
      s.values[p.cell] = p.digit;
      for (const q of PEERS[p.cell]) {
        s.pencil[q] &= ~bit(p.digit);
        s.centre[q] &= ~bit(p.digit);
      }
    }
  });
  if (step.placements.length) {
    select(step.placements[0].cell, false);
    maybeAutoFinish();
  }
  render();
}

function check(): void {
  S.flash.clear();
  if (!S.solution) return setStatus("Check needs a puzzle with exactly one solution.", "bad");
  const wrong: number[] = [];
  let empty = 0;
  S.cur.values.forEach((v, i) => {
    if (!v) empty++;
    else if (v !== S.solution![i]) wrong.push(i);
  });
  wrong.forEach((c) => S.flash.add(c));
  if (wrong.length) setStatus(`${wrong.length} ${wrong.length === 1 ? "digit is" : "digits are"} wrong (marked red).`, "bad");
  else if (empty) setStatus(`Everything is correct so far. ${empty} ${empty === 1 ? "cell" : "cells"} to go.`, "good");
  render();
}

function select(i: number, extend: boolean): void {
  if (!extend) S.selection.clear();
  S.selection.add(i);
  S.primary = i;
}

// ---------------------------------------------------------------------------
// Rendering

const $ = (id: string) => document.getElementById(id)!;
const boardEl = $("board");
let view: BoardView;

function buildBoard(): void {
  view = new BoardView(boardEl);

  // Selecting with the mouse or a finger: click, drag, Shift to add, Ctrl/Cmd to remove.
  let drag: "add" | "remove" | null = null;
  const cellAt = (x: number, y: number): number | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(".cell");
    return el && boardEl.contains(el) ? Number(el.dataset.i) : null;
  };
  boardEl.addEventListener("pointerdown", (e) => {
    const i = cellAt(e.clientX, e.clientY);
    if (i === null) return;
    e.preventDefault();
    boardEl.focus({ preventScroll: true });
    if (e.ctrlKey || e.metaKey) {
      drag = "remove";
      S.selection.delete(i);
    } else {
      drag = "add";
      select(i, e.shiftKey);
    }
    boardEl.setPointerCapture(e.pointerId);
    render();
  });
  boardEl.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i === null) return;
    if (drag === "add" && !(S.selection.has(i) && S.primary === i)) {
      select(i, true);
      render();
    } else if (drag === "remove" && S.selection.has(i)) {
      S.selection.delete(i);
      render();
    }
  });
  const end = () => (drag = null);
  boardEl.addEventListener("pointerup", end);
  boardEl.addEventListener("pointercancel", end);
}

const padButtons: HTMLButtonElement[] = [];
function buildPad(): void {
  const pad = $("pad");
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span class="num">${d}</span><span class="left"></span>`;
    b.style.setProperty("--swatch", `var(--c${d})`);
    b.addEventListener("click", (e) => enterNumber(d, effectiveMode(e.shiftKey)));
    pad.appendChild(b);
    padButtons.push(b);
  }
}

function renderModes(): void {
  const m = effectiveMode();
  boardEl.className = `board mode-${m}`;
  document.querySelectorAll<HTMLButtonElement>("#modes .mode-btn").forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
  const pad = $("pad");
  pad.className = `pad pad-${m}`;
  const counts = new Array(10).fill(0);
  S.cur?.values.forEach((v) => v && counts[v]++);
  const names: Record<Mode, string> = { digit: "Digit", pencil: "Candidate", centre: "Pair", color: "Colour" };
  padButtons.forEach((b, k) => {
    const left = 9 - counts[k + 1];
    (b.querySelector(".left") as HTMLElement).textContent = m === "digit" && left > 0 ? String(left) : "";
    b.classList.toggle("done", m === "digit" && left <= 0);
    b.setAttribute("aria-label", m === "digit" ? `Digit ${k + 1}, ${Math.max(left, 0)} left` : `${names[m]} ${k + 1}`);
  });
  $("erase").textContent = m === "color" ? "Clear colour" : "Erase";
}

function render(): void {
  const { values, colors, centre } = S.cur;
  const set = S.settings;
  const prim = S.primary;
  const primVal = values[prim];
  const clashes = new Grid(values, empty81()).conflicts();
  const single = S.selection.size === 1;

  const hint = S.hint;
  const step: Step | null = hint && hint.kind === "step" ? hint.step : null;
  const full = !!step && S.hintLevel === 2;
  const decor = stepDecor(step, full);
  view.drawLinks(full ? step : null);

  for (let i = 0; i < 81; i++) {
    const el = view.cells[i];
    const v = values[i];
    const isPeer = set.peers && single && i !== prim && (rowOf(i) === rowOf(prim) || colOf(i) === colOf(prim) || boxOf(i) === boxOf(prim));
    el.classList.toggle("given", S.givens[i]);
    el.classList.toggle("sel", S.selection.has(i));
    el.classList.toggle("primary", i === prim && S.selection.has(i));
    el.classList.toggle("peer", isPeer);
    el.classList.toggle("same", set.same && !!primVal && v === primVal && i !== prim);
    el.classList.toggle("region", decor.region.has(i));
    el.classList.toggle("pattern", decor.pattern.has(i));
    el.classList.toggle("target", decor.target.has(i));
    el.classList.toggle("error", S.flash.has(i));
    el.classList.toggle("clash", clashes.has(i));
    el.classList.toggle("mistake", set.mistakes && !!S.solution && !S.givens[i] && !!v && v !== S.solution[i]);
    el.classList.toggle("pop", S.popped.has(i));
    view.paint[i].style.background = paintBackground(colors[i]);
    view.vals[i].textContent = v ? String(v) : "";

    // Pairs are shown in the centre and replace the candidate grid, except during a full
    // hint, when the candidates the engine reasons with are shown so the whole pattern is visible.
    const showCentre = !v && !!centre[i] && !full;
    const cd = digitsOf(centre[i]);
    view.centre[i].textContent = showCentre ? cd.join("") : "";
    view.centre[i].className = `centre${cd.length > 4 ? " many" : ""}`;
    const m = v || showCentre ? 0 : full ? shownCands(i) | engineCands(i) : shownCands(i);
    for (let d = 1; d <= 9; d++) {
      const s = view.cands[i][d - 1];
      const on = !!(m & bit(d));
      s.textContent = on ? String(d) : "";
      s.className = on ? decor.candClass.get(i * 10 + d) ?? (set.same && primVal === d ? "hl" : "") : "";
    }
    el.setAttribute("aria-label", `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}: ${v ? v : "empty"}`);
    el.setAttribute("aria-selected", String(S.selection.has(i)));
  }

  renderModes();
  ($("undo") as HTMLButtonElement).disabled = !S.undo.length;
  ($("redo") as HTMLButtonElement).disabled = !S.redo.length;
  $("fill-cands").hidden = set.auto;
  $("puzzle-label").textContent = S.label;
  $("puzzle-code").textContent = S.code;
  $("timer").hidden = !set.timer;

  // Options
  (["auto", "mistakes", "tidy", "peers", "same", "timer", "patterns"] as const).forEach((k) => (($(`opt-${k}`) as HTMLInputElement).checked = set[k]));
  ($("opt-maxalt") as HTMLSelectElement).value = String(set.maxAlt);
  ($("opt-finish") as HTMLSelectElement).value = String(set.autoFinish);
  ($("opt-theme") as HTMLSelectElement).value = set.theme;

  // Hint card
  const card = $("hint-card");
  card.hidden = !hint;
  card.classList.toggle("error", hint?.kind === "error");
  const more = $("hint-more") as HTMLButtonElement;
  const apply = $("hint-apply") as HTMLButtonElement;
  const chain = $("hint-chain");
  chain.hidden = true;
  $("hint-note").hidden = true;
  if (hint) {
    if (hint.kind === "step") {
      $("hint-tech").textContent = hint.step.technique;
      $("hint-text").textContent = full ? hint.step.explanation : hint.step.nudge;
      const forced = set.patterns && isGrindyStep(hint.step);
      $("hint-note").hidden = !forced;
      if (forced)
        $("hint-note").textContent = hint.step.chainDigits
          ? "Nothing shorter works here, so this long chain is the way forward."
          : `No pattern up to ${ALT_TIERS[set.maxAlt] ?? "Expert"} level works here, so this subset is the way forward.`;
      if (full && hint.step.notation) {
        chain.textContent = hint.step.notation;
        chain.hidden = false;
      }
      more.hidden = full;
      apply.hidden = !full;
    } else {
      $("hint-tech").textContent = hint.kind === "error" ? "Something is off" : hint.kind === "solved" ? "Solved" : "No hint available";
      $("hint-text").textContent = hint.message;
      more.hidden = true;
      apply.hidden = true;
    }
  }

  document.querySelectorAll<HTMLButtonElement>(".chip").forEach((c) => c.classList.toggle("on", c.dataset.puzzle === S.puzzle));
}

function setStatus(msg: string, kind: "" | "good" | "bad" = ""): void {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

// ---------------------------------------------------------------------------
// Theme

const hostTheme = document.documentElement.getAttribute("data-theme");
function applyTheme(): void {
  const t = S.settings.theme;
  const root = document.documentElement;
  if (t !== "system") root.setAttribute("data-theme", t);
  else if (hostTheme) root.setAttribute("data-theme", hostTheme);
  else root.removeAttribute("data-theme");
}

// ---------------------------------------------------------------------------
// Wiring

function setMode(m: Mode): void {
  S.mode = m;
  render();
}

function setTab(t: Tab): void {
  S.tab = t;
  for (const name of TABS) {
    $(`pane-${name}`).hidden = name !== t;
    $(`tab-${name}`).classList.toggle("on", name === t);
    $(`tab-${name}`).setAttribute("aria-selected", String(name === t));
  }
  $("play-view").hidden = t === "techniques";
  $("guide-view").hidden = t !== "techniques";
  if (t === "techniques") showGuide();
}

function move(dr: number, dc: number, extend: boolean): void {
  const r = (rowOf(S.primary) + dr + 9) % 9;
  const c = (colOf(S.primary) + dc + 9) % 9;
  select(r * 9 + c, extend);
  render();
}

function onKey(e: KeyboardEvent): void {
  const t = e.target as HTMLElement;
  if (e.key === "Shift" && !S.shift) {
    S.shift = true;
    renderModes();
  }
  if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT") return;
  const k = e.key;
  const ctrl = e.ctrlKey || e.metaKey;

  if (S.tab === "techniques") {
    if (k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      moveGuide(k === "ArrowUp" ? -1 : 1);
    }
    return;
  }

  if (ctrl && (k === "z" || k === "Z")) {
    e.preventDefault();
    return e.shiftKey ? doRedo() : doUndo();
  }
  if (ctrl && (k === "y" || k === "Y")) {
    e.preventDefault();
    return doRedo();
  }
  if (ctrl || e.altKey) return;

  // Shift+digit gives "!" etc. on many layouts, so read the physical key too.
  // On Windows, Shift+numpad digit arrives without shiftKey but as "End", "ArrowDown", ...
  const codeDigit = /^(Digit|Numpad)([1-9])$/.exec(e.code);
  if (codeDigit || /^[1-9]$/.test(k)) {
    e.preventDefault();
    const d = codeDigit ? Number(codeDigit[2]) : Number(k);
    const numpadShift = !!codeDigit && codeDigit[1] === "Numpad" && !/^[1-9]$/.test(k);
    return enterNumber(d, effectiveMode(e.shiftKey || numpadShift));
  }
  const lower = k.toLowerCase();
  if (MODE_KEYS[lower]) return setMode(MODE_KEYS[lower]);
  switch (k) {
    case "ArrowUp": e.preventDefault(); return move(-1, 0, e.shiftKey);
    case "ArrowDown": e.preventDefault(); return move(1, 0, e.shiftKey);
    case "ArrowLeft": e.preventDefault(); return move(0, -1, e.shiftKey);
    case "ArrowRight": e.preventDefault(); return move(0, 1, e.shiftKey);
    case "0":
      e.preventDefault();
      return S.mode === "color" ? clearColorsOfSelection() : erase();
    case "Backspace": case "Delete": e.preventDefault(); return erase();
    case " ":
      if (t.tagName === "BUTTON" || t.tagName === "SUMMARY") return;
      e.preventDefault();
      return setMode(MODES[(MODES.indexOf(S.mode) + 1) % MODES.length]);
    case "h": case "H": return showHint();
    case "Escape":
      if (S.hint) S.hint = null;
      else select(S.primary, false);
      return render();
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === "Shift" && S.shift) {
    S.shift = false;
    renderModes();
  }
}

function copyText(text: string, msgEl: HTMLElement, selectEl?: HTMLElement): void {
  const fallback = () => {
    if (selectEl) {
      const range = document.createRange();
      range.selectNodeContents(selectEl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      msgEl.textContent = "Code selected; press Ctrl+C (or Cmd+C) to copy.";
      return;
    }
    const ta = $("import") as HTMLTextAreaElement;
    ta.value = text;
    ta.focus();
    ta.select();
    msgEl.textContent = "Selected in the box above; press Ctrl+C (or Cmd+C) to copy.";
  };
  try {
    navigator.clipboard.writeText(text).then(() => (msgEl.textContent = "Copied to the clipboard."), fallback);
  } catch {
    fallback();
  }
}

function init(): void {
  applyTheme();
  buildBoard();
  buildPad();
  initGuide();

  const samples = $("samples");
  for (const s of SAMPLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.puzzle = s.puzzle;
    b.title = s.note;
    b.textContent = s.name;
    b.addEventListener("click", () => {
      loadPuzzle(s.puzzle, s.name);
      $("puzzle-msg").textContent = `Loaded “${s.name}”: ${s.note.toLowerCase()}.`;
    });
    samples.appendChild(b);
  }

  for (const name of TABS) $(`tab-${name}`).addEventListener("click", () => setTab(name));
  document.querySelectorAll<HTMLButtonElement>("#modes .mode-btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode as Mode)));
  $("undo").addEventListener("click", doUndo);
  $("redo").addEventListener("click", doRedo);
  $("erase").addEventListener("click", erase);
  $("hint").addEventListener("click", showHint);
  $("hint-more").addEventListener("click", showHint);
  $("hint-apply").addEventListener("click", applyHint);
  $("hint-close").addEventListener("click", () => {
    S.hint = null;
    S.flash.clear();
    render();
  });
  $("check").addEventListener("click", check);
  $("fill-cands").addEventListener("click", fillCandidates);
  $("clear-cands").addEventListener("click", clearCandidates);

  $("opt-theme").addEventListener("change", (e) => {
    S.settings.theme = (e.target as HTMLSelectElement).value as Settings["theme"];
    saveSettings();
    applyTheme();
  });
  $("opt-finish").addEventListener("change", (e) => {
    S.settings.autoFinish = Number((e.target as HTMLSelectElement).value);
    saveSettings();
  });
  $("opt-auto").addEventListener("change", (e) => setAuto((e.target as HTMLInputElement).checked));
  $("opt-maxalt").addEventListener("change", (e) => {
    S.settings.maxAlt = Number((e.target as HTMLSelectElement).value);
    saveSettings();
    S.hint = null;
    S.rating = null;
    renderRating();
    render();
    setTimeout(() => rate(Grid.fromString(S.puzzle)), 30);
  });
  (["mistakes", "tidy", "peers", "same", "timer", "patterns"] as const).forEach((k) =>
    $(`opt-${k}`).addEventListener("change", (e) => {
      S.settings[k] = (e.target as HTMLInputElement).checked;
      saveSettings();
      render();
    }),
  );

  $("load").addEventListener("click", () => {
    const text = ($("import") as HTMLTextAreaElement).value;
    const err = loadPuzzle(text, "Imported");
    $("puzzle-msg").textContent = err ?? "Puzzle loaded.";
  });
  $("copy").addEventListener("click", () => copyText(S.puzzle, $("puzzle-msg")));
  $("copy-code").addEventListener("click", () => copyText(S.code, $("status"), $("puzzle-code")));
  // On the website (not inside a frame), offer a link that opens this exact puzzle.
  const onWebsite = /^https?:$/.test(location.protocol) && window.self === window.top;
  $("copy-link").hidden = !onWebsite;
  $("copy-link").addEventListener("click", () => copyText(`${location.origin}${location.pathname}#${S.code}`, $("status")));

  const pick = $("diff-pick");
  for (const d of DIFFICULTIES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.d = d;
    b.textContent = d;
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => {
      S.settings.genDifficulty = d;
      saveSettings();
      renderGen();
    });
    pick.appendChild(b);
  }
  $("gen-light").addEventListener("change", (e) => {
    S.settings.genLight = (e.target as HTMLInputElement).checked;
    saveSettings();
  });
  $("generate").addEventListener("click", startGenerate);
  $("gen-cancel").addEventListener("click", cancelGenerate);
  $("restart").addEventListener("click", () => {
    loadPuzzle(S.puzzle, S.label);
    $("puzzle-msg").textContent = "Restarted.";
  });
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    if (!S.shift) return;
    S.shift = false;
    renderModes();
  });

  setInterval(() => {
    const end = S.solvedAt || Date.now();
    $("timer").textContent = fmtTime(end - S.startedAt);
  }, 500);

  setTab("play");
  renderGen();
  // A puzzle code after # in the address (for hosting on your own site) opens that puzzle.
  const fromLink = location.hash.length > 1 && loadPuzzle(decodeURIComponent(location.hash.slice(1)), "Shared") === null;
  if (!fromLink) loadPuzzle(SAMPLES[0].puzzle, SAMPLES[0].name);
}

init();
