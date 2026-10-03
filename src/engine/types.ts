// Shared types for techniques and hints.
import type { Grid } from "./grid";

export interface CellDigit {
  cell: number;
  digit: number;
}

/** A link between two candidates, drawn as a line on the board. */
export interface Link {
  from: CellDigit;
  to: CellDigit;
  /** Strong: at least one of the two is true. Weak: at most one is true. */
  strong: boolean;
}

export interface Step {
  /** Technique name shown to the player, e.g. "Hidden Pair". */
  technique: string;
  /** Difficulty level of the technique (higher = harder). */
  level: number;
  /** Digits this step places. */
  placements: CellDigit[];
  /** Candidates this step removes. */
  eliminations: CellDigit[];
  /** Cells that form the pattern. */
  cells: number[];
  /** Candidates that form the pattern (drawn in the hint color). */
  candidates: CellDigit[];
  /** Units (indices into UNITS) to shade lightly. */
  units: number[];
  /** Lines between candidates (chains, coloring). */
  links?: Link[];
  /** Two-color marking (coloring): color 0 or 1. */
  colors?: (CellDigit & { color: 0 | 1 })[];
  /** For chains: how many different digits the chain uses. */
  chainDigits?: number;
  /** Chain written out in compact notation, e.g. "(4)r3c1 = (4)r3c7 − (4)r8c7 = (4)r8c2". */
  notation?: string;
  /** Short teaser that names the technique and where to look, without giving it away. */
  nudge: string;
  /** Full explanation in plain English. */
  explanation: string;
}

export interface Technique {
  name: string;
  level: number;
  find: (g: Grid) => Step | null;
}
