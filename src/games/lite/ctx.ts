// The shared context of one light puzzle page: the type (g), the page's elements, options,
// the game state S, and the functions of every part (puzzles, editing, render, pointer, pad,
// guide, keys; setTab and renderOptions from ../lite.ts). Each part is a function that gets
// this context and returns its own functions; initLite puts them all on it. A part calls
// another part's function as ctx.name(), so the order the parts are made in doesn't matter.

import type { LiteHint } from "../logic";
import type { LiteOptionStore, LiteOptions } from "./options";
import type { PrintPuzzle } from "../../ui/print";
import type { LiteGame, LitePuzzle, Snap, Tab, ThemeHooks } from "./types";

/** The game state of a page. */
export function newState<P extends LitePuzzle>(g: LiteGame<P>) {
  return {
    p: null as P | null,
    code: "",
    level: "",
    pickSize: g.defaultSize,
    pickLevel: g.levels[1] ?? g.levels[0],
    cur: { cells: [], cands: [] } as Snap,
    undo: [] as Snap[],
    redo: [] as Snap[],
    sel: 0,
    selection: new Set<number>([0]),
    /** The selection in the order it was made. */
    selOrder: [0] as number[],
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
    /** Smart input: the selection is just the last tapped cell, not marked on the board. */
    quiet: false,
    /** A digit tapped on the pad with no cell selected: its cells and candidates are marked. */
    padDigit: 0,
  };
}

export type LiteState<P extends LitePuzzle> = ReturnType<typeof newState<P>>;

/** What initLite sets up before the parts are made. */
export interface LiteBase<P extends LitePuzzle> {
  g: LiteGame<P>;
  root: HTMLElement;
  theme?: ThemeHooks;
  /** The element with data-r="r" (optional parts, such as the notes, are null when a type doesn't have them). */
  el(r: string): HTMLElement;
  all(r: string): NodeListOf<HTMLElement>;
  btn(r: string): HTMLButtonElement;
  board: HTMLElement;
  /** This type is the one on screen. */
  active(): boolean;
  store: LiteOptionStore;
  opt: LiteOptions;
  S: LiteState<P>;
  /** The board's cells (built by render.ts buildBoard). */
  cellEls: HTMLElement[];
  /** Delays (ms) for marks that should appear one after another, set by ripple(), used by the next render. */
  delays: Map<number, number>;
  /** The type has no candidates (Star Battle). */
  noCands: boolean;
  /** A placed value as HTML (a digit, ✕, or the type's own glyph). */
  show(v: number): string;
  valueName(v: number): string;
  n(): number;
  maxDigit(): number;
  nameOf(code: string, level: string): string;
  status(msg: string, kind?: "" | "good" | "bad"): void;
}

/** The functions the parts provide. */
export interface LiteParts<P extends LitePuzzle> {
  // puzzles.ts
  start(p: P, level?: string): void;
  newPuzzle(): void;
  save(): void;
  restore(code?: string): boolean;
  recordSolve(): string;
  renderStats(): void;
  printPuzzle(p: P, level: string, progress: boolean): PrintPuzzle;
  openPrint(many: boolean): void;
  copyLink(): void;
  // editing.ts
  editable(): number[];
  change(fn: (s: Snap) => void): void;
  pushUndo(before: Snap): void;
  autoDots(before: Snap, s: Snap): void;
  afterChange(): void;
  pencilOn(): boolean;
  enter(v: number, asCandidate?: boolean): void;
  allHaveCand(v: number): boolean;
  setCand(s: Snap, v: number, add: boolean): void;
  startRingHold(): void;
  stopRingHold(): void;
  erase(): void;
  undo(): void;
  redo(): void;
  check(): void;
  reveal(): void;
  hint(): void;
  applyHint(): void;
  snap(): Snap;
  commitFrom(before: Snap): void;
  // render.ts
  buildBoard(): void;
  render(): void;
  // pointer.ts
  setSelection(cells: number[]): void;
  addCell(i: number): void;
  // pad.ts
  buildPad(): void;
  wirePad(): void;
  // guide.ts
  buildGuideList(): void;
  showGuide(name: string): void;
  // keys.ts
  onKey(e: KeyboardEvent): void;
  // ../lite.ts
  setTab(t: Tab): void;
  renderOptions(): void;
}

export type LiteCtx<P extends LitePuzzle> = LiteBase<P> & LiteParts<P>;
