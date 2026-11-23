// Loading puzzles, saving the game (so a later visit continues it), the timer.

import { t } from "../i18n";
import { DIFFICULTIES, Grid, Rating, countSolutions, decodePuzzle, encodePuzzle } from "../../engine";
import type { Generated } from "../../engine";
import { puzzleName } from "../../names";
import { PALETTES } from "../board";
import { currentGame } from "../games";
import { markPlayed } from "../played";
import { rate, renderRating } from "./generate";
import { $, fmtTime, render, setStatus } from "./render";
import { S, empty81 } from "./state";
import type { Snapshot } from "./state";

// Loading puzzles

/** Read a puzzle code or an 81-character puzzle. */
export function parsePuzzle(text: string): number[] {
  const clean = text.replace(/\s+/g, "");
  if (clean.length === 81) return Grid.fromString(clean).values;
  if (!clean) throw new Error(t("Paste a puzzle code or 81 characters first."));
  if (/^[0-9.]+$/.test(clean)) throw new Error(t("Expected 81 characters, got {n}.", { n: clean.length }));
  return decodePuzzle(clean);
}

/**
 * Load a puzzle from a code or 81-character string. `known` skips the solution
 * search and the rating when the generator already did that work.
 */
export function loadPuzzle(text: string, label: string, known?: Generated): string | null {
  let g: Grid;
  try {
    g = new Grid(parsePuzzle(text));
  } catch (e) {
    return (e as Error).message;
  }
  const res = known ? { count: 1, solution: known.solution } : countSolutions(g.values, 2);
  if (res.count === 0) return t("This puzzle has no solution. Check for typos.");
  S.puzzle = g.toString();
  S.code = encodePuzzle(g.values);
  markPlayed(S.code);
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
  S.elapsed = 0;
  S.solved = false;
  S.hintsUsed = 0;
  S.daily = null;
  S.author = "";
  S.solvedNote = "";
  S.lastInput = Date.now();
  setStatus(res.count === 1 ? "" : t("This puzzle has more than one solution, so Check and mistake highlighting are off."), res.count === 1 ? "" : "bad");
  S.rating = known ? known.rating : null;
  renderRating();
  render();
  saveGame();
  if (!known) setTimeout(() => rate(g), 30);
  return null;
}

/** No puzzle yet: an empty grid, waiting for one to be generated or loaded. */
export function clearPuzzle(): void {
  S.puzzle = "";
  S.code = "";
  S.label = "";
  S.givens = new Array(81).fill(false);
  S.solution = null;
  S.cur = { values: empty81(), pencil: empty81(), removed: empty81(), centre: empty81(), colors: empty81() };
  S.undo = [];
  S.redo = [];
  S.rating = null;
  renderRating();
  render();
}

/** True (and a nudge to the Puzzles tab) when there is nothing to play yet. */
export function noPuzzle(): boolean {
  if (S.puzzle) return false;
  setStatus(t("Generate or load a puzzle in the Puzzles tab first."));
  return true;
}

/** The difficulty a label stands for ("Daily Hard" → "Hard"), or "" when it doesn't say. */
export function difficultyOfLabel(label: string): string {
  const d = label.replace(/^Daily /, "");
  return (DIFFICULTIES as readonly string[]).includes(d) || d === "Custom" ? d : "";
}

/** The name of a puzzle (81 characters), by its label or else its rating. */
export function nameOf(puzzle: string, label: string, rating?: Rating | null): string {
  const d = difficultyOfLabel(label) || (rating?.solved ? rating.difficulty : "Other");
  return puzzleName(puzzle, d);
}

/** The name of the puzzle being played. */
export const currentName = () => (S.puzzle ? nameOf(S.puzzle, S.daily ? S.daily.difficulty : S.label, S.rating) : "");

// Saving the game, so a reload or a later visit picks up where you left off

export const SAVE_KEY = "sudokug-games";
export const OLD_SAVE_KEY = "sudokug-game";
/** How many games in progress are remembered (most recent first). */
export const MAX_SAVED = 12;

export interface SavedGame {
  v: 1;
  puzzle: string;
  label: string;
  cur: Snapshot;
  undo: Snapshot[];
  elapsed: number;
  solved: boolean;
  hints?: number;
  daily?: { date: string; difficulty: string } | null;
  author?: string;
  at?: number;
}

export interface SaveFile {
  v: 1;
  current: string;
  games: Record<string, SavedGame>;
}

export function readSaves(): SaveFile {
  const empty: SaveFile = { v: 1, current: "", games: {} };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const f = JSON.parse(raw);
      if (f?.v === 1 && f.games && typeof f.games === "object") return f;
    }
    // Saves from the previous version (one game only).
    const old = localStorage.getItem(OLD_SAVE_KEY);
    if (old) {
      const g = JSON.parse(old);
      if (g?.v === 1 && typeof g.puzzle === "string") return { v: 1, current: g.puzzle, games: { [g.puzzle]: g } };
    }
  } catch {
    /* unreadable: start fresh */
  }
  return empty;
}

export let saveTimer = 0;
export function saveSoon(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveGame, 300);
}

export function saveGame(): void {
  try {
    const f = readSaves();
    f.current = S.puzzle;
    if (S.puzzle) {
      f.games[S.puzzle] = {
        v: 1,
        puzzle: S.puzzle,
        label: S.label,
        cur: S.cur,
        undo: S.undo.slice(-60),
        elapsed: S.elapsed,
        solved: S.solved,
        hints: S.hintsUsed,
        daily: S.daily,
        author: S.author,
        at: Date.now(),
      };
      // Keep only the most recent games.
      const keys = Object.keys(f.games).sort((x, y) => (f.games[y].at ?? 0) - (f.games[x].at ?? 0));
      for (const k of keys.slice(MAX_SAVED)) delete f.games[k];
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(f));
    localStorage.removeItem(OLD_SAVE_KEY);
  } catch {
    /* storage full or unavailable: the game just isn't saved */
  }
}

export const isMasks = (a: unknown): a is number[] => Array.isArray(a) && a.length === 81 && a.every((x) => Number.isInteger(x) && x >= 0 && x < 512);
export const fixSnapshot = (s: Partial<Snapshot> | undefined): Snapshot | null => {
  if (!s || !isMasks(s.values) || s.values.some((v) => v > 9)) return null;
  return {
    values: s.values,
    pencil: isMasks(s.pencil) ? s.pencil : empty81(),
    removed: isMasks(s.removed) ? s.removed : empty81(),
    centre: isMasks(s.centre) ? s.centre : empty81(),
    colors: Array.isArray(s.colors) && s.colors.length === 81 && s.colors.every((x) => Number.isInteger(x) && x >= 0 && x < 1 << (9 * PALETTES)) ? s.colors : empty81(),
  };
};

/** Restore a saved game: the given puzzle (81 characters), or the last one played. */
export function restoreGame(puzzle?: string): boolean {
  const f = readSaves();
  const data = f.games[puzzle ?? f.current];
  if (!data || data.v !== 1 || typeof data.puzzle !== "string") return false;
  const cur = fixSnapshot(data.cur);
  if (!cur || loadPuzzle(data.puzzle, data.label || "Saved") !== null) return false;
  // Never let a saved state overwrite the starting digits.
  if (cur.values.some((v, i) => S.givens[i] && v !== S.cur.values[i])) return false;
  S.cur = cur;
  S.undo = (Array.isArray(data.undo) ? data.undo : []).map(fixSnapshot).filter((x): x is Snapshot => !!x);
  S.elapsed = Math.max(0, Number(data.elapsed) || 0);
  S.solved = !!data.solved;
  S.hintsUsed = Number(data.hints) || 0;
  S.daily = data.daily && typeof data.daily.date === "string" ? data.daily : null;
  S.author = typeof data.author === "string" ? data.author : "";
  S.solvedNote = S.solved ? t("Solved in {time}.", { time: fmtTime(S.elapsed) }) : "";
  render();
  saveGame();
  return true;
}

/** Open a puzzle: continue it if it was played before, otherwise start it fresh. */
export function openPuzzle(text: string, label: string, meta?: { daily?: { date: string; difficulty: string }; author?: string }): string | null {
  let key: string;
  try {
    key = new Grid(parsePuzzle(text)).toString();
  } catch (e) {
    return (e as Error).message;
  }
  if (restoreGame(key)) return null;
  const err = loadPuzzle(key, label);
  if (err) return err;
  S.daily = meta?.daily ?? null;
  S.author = meta?.author ?? "";
  render();
  saveGame();
  return null;
}

// Timer: counts only while the page is visible and you have been active recently

export const IDLE_MS = 2 * 60 * 1000;
export function startTimer(): void {
  const mark = () => (S.lastInput = Date.now());
  document.addEventListener("pointerdown", mark, { capture: true });
  document.addEventListener("keydown", mark, { capture: true });
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = Math.min(now - last, 2000);
    last = now;
    const playing = !!S.puzzle && !S.solved && currentGame() === "sudoku";
    const active = playing && document.visibilityState === "visible" && now - S.lastInput < IDLE_MS;
    if (active && !S.finishing) S.elapsed += dt;
    const el = $("timer");
    el.textContent = fmtTime(S.elapsed);
    el.classList.toggle("paused", playing && !active);
    el.title = playing && !active ? t("Paused: carries on when you click or type") : "";
  }, 500);
}
