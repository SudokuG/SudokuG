// Types of the light puzzle page: what a puzzle type (LiteGame) supplies, and the shared
// snapshot and tab types.

import type { LiteSolver } from "../logic";
import type { LiteOptions } from "./options";
import type { GameId } from "../../ui/games";

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
  /** X's per row and column (0: the type has no X's; types with X's also get the ring mark). Star Battle sets 1: its crosses are its X's, and its own clash check counts them. */
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
   * rest of full rows, columns and regions); with the "Cross automatically" option they get X's.
   */
  autoMarks?(p: P, cells: number[]): Set<number>;
  /** Solved before every cell is filled in (Star Battle: all the stars are right). */
  isSolved?(p: P, cells: number[]): boolean;
  /** Options that start differently for this type (Star Battle: no auto-finish). */
  optionDefaults?: Partial<LiteOptions>;
  /** Offer smart input (Star Battle): tap or drag to cross, double tap for a star, hold to clear. */
  smartInput?: boolean;
  /** The size as shown on the size buttons (default "8×8"). */
  sizeLabel?(n: number): string;
  /** The "Mouse, keyboard and touch" list items (HTML), instead of the default for digits. */
  controls?: string;
  /**
   * The region of each cell (Star Battle: regions, Calcudoku: cages): drawn with thick lines,
   * and shaded around the selected cell with the "Highlight region" option.
   */
  regions?(p: P): number[];
  /** What a region is called in the options ("cage"; default "region"). */
  regionWord?: string;
  /** The cells don't touch (Futoshiki): each selected cell gets its own frame, not one outline per group. */
  separateCells?: boolean;
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

/** The entries and candidates of a game, as one undo step remembers them. */
export type Snap = { cells: number[]; cands: number[] };
export type Tab = "play" | "puzzles" | "options" | "techniques";
