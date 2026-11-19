// Sudoku page state: settings, the current game, snapshots for undo, candidates as shown.

import { ALL, Grid, Hint, PEERS, Rating, TECHNIQUES, TEMPLATES, bit } from "../../engine";
import { PALETTES } from "../board";


export type Mode = "digit" | "pencil" | "centre" | "color";
export const MODES: Mode[] = ["digit", "pencil", "centre", "color"];
export const MODE_KEYS: Record<string, Mode> = { z: "digit", x: "pencil", c: "centre", v: "color" };
export type Tab = "play" | "puzzles" | "options" | "techniques";
export const TABS: Tab[] = ["play", "puzzles", "options", "techniques"];

/** The part of the state that undo/redo tracks. */
export interface Snapshot {
  values: number[];
  /** Candidates the player wrote down (used when auto-candidates is off). */
  pencil: number[];
  /** Candidates removed by the player or by hints (used when auto-candidates is on). */
  removed: number[];
  /** "Pairs": small digits written in the centre of a cell. */
  centre: number[];
  /** Cell colours: bits 0-8 are colours 1-9 of the first palette, 9-17 the second, 18-26 the third. */
  colors: number[];
}

export interface Settings {
  theme: "system" | "light" | "dark";
  auto: boolean;
  mistakes: boolean;
  tidy: boolean;
  /** Shade the row and column of the selected cell. */
  peers: boolean;
  /** Shade the box of the selected cell. */
  box: boolean;
  same: boolean;
  timer: boolean;
  /** Fill in the rest when at most this many cells are left (0 = off). */
  autoFinish: number;
  /** Hints try patterns before triples and quads. */
  patterns: boolean;
  /** Generator: the techniques a new puzzle may need. */
  genProfile: string[];
  /** Phone S key: stays on until pressed again (instead of only while held). */
  stickyToggle: boolean;
  /** Number pad shows how many of each digit are left. */
  padCounts: boolean;
  /** The keyboard's number pad enters candidates (the digit row still enters digits). */
  numpadCands: boolean;
  /** After making a new puzzle, switch to the Play tab. */
  toPlay: boolean;
  /** Outline the selected cells. */
  outline: boolean;
  /** "Highlight the same digit" also shades the cells that have it as a candidate or pair. */
  candShade: boolean;
  /** Sliding a finger over the pad keys toggles those candidates (pairs, colours). */
  sweep: boolean;
  /** Sweeping also works in Digit mode (the keys then go in as candidates). */
  sweepDigit: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  auto: false,
  mistakes: false,
  tidy: true,
  peers: true,
  box: true,
  same: true,
  timer: true,
  autoFinish: 10,
  patterns: true,
  genProfile: TEMPLATES.Hard,
  stickyToggle: false,
  padCounts: true,
  numpadCands: false,
  toPlay: true,
  outline: true,
  candShade: true,
  sweep: true,
  sweepDigit: true,
};

/** Fixed: patterns up to Expert level count as an alternative to a triple or quad. */
export const MAX_ALT = 7;

export const DIFF_DESC: Record<string, string> = {
  Easy: "Singles only. You can solve it without writing candidates.",
  Medium: "Adds locked candidates and pairs.",
  Hard: "Adds X-Wing, Skyscraper, 2-String Kite and Turbot Fish.",
  Expert: "Adds XY-Wing, XYZ-Wing, coloring and Swordfish.",
  Extreme: "Adds one- and two-digit chains and Jellyfish.",
};
/** Give up after this many tries (some custom mixes are very rare). */
export const MAX_TRIES = 800;
export const SETTINGS_KEY = "pattern-sudoku-settings"; // kept so saved settings survive the rename
export const SINGLES = TECHNIQUES.filter((t) => t.level <= 1);

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // "Highlight row, column and box" was one option: the box keeps its old choice.
      if (saved && saved.box === undefined && typeof saved.peers === "boolean") saved.box = saved.peers;
      const s = { ...DEFAULT_SETTINGS, ...saved };
      // Keep only technique names that still exist.
      const known = new Set(TECHNIQUES.map((t) => t.name));
      s.genProfile = Array.isArray(s.genProfile) ? s.genProfile.filter((n: string) => known.has(n)) : DEFAULT_SETTINGS.genProfile;
      return s;
    }
  } catch {
    /* storage unavailable: use defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.settings));
  } catch {
    /* ignore */
  }
}

export const empty81 = () => new Array(81).fill(0);

export const S = {
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
  /** Active solving time in ms. Counts only while the page is visible and you are not idle. */
  elapsed: 0,
  solved: false,
  /** Time of the last click or key press (idle detection). */
  lastInput: Date.now(),
  /** Hints asked for in this game (best times only count games without hints). */
  hintsUsed: 0,
  /** Where the puzzle came from: daily date + difficulty, and the setter's name if known. */
  daily: null as { date: string; difficulty: string } | null,
  author: "",
  /** "S" key on phones: keep adding cells to the selection, and enter candidates. */
  sticky: false,
  /** Colour palette that Colour mode paints with (0-2), and which palettes are hidden. */
  palette: 0,
  colorHidden: new Array(PALETTES).fill(false) as boolean[],
  /** Text on the "solved" card. */
  solvedNote: "",
  tab: "play" as Tab,
  rating: null as Rating | null,
  code: "",
  /** Auto-finish is filling in cells; input is paused. */
  finishing: false,
  popped: new Set<number>(),
  /** A digit tapped on the pad with no cell selected: its cells and candidates are marked. */
  padDigit: 0,
};

export const clone = (s: Snapshot): Snapshot => ({
  values: s.values.slice(),
  pencil: s.pencil.slice(),
  removed: s.removed.slice(),
  centre: s.centre.slice(),
  colors: s.colors.slice(),
});

/** The mode a number entry will use right now. */
export const effectiveMode = (shiftKey = false): Mode => ((S.shift || S.sticky || shiftKey) && S.mode === "digit" ? "pencil" : S.mode);

/** Candidates implied by the placed digits alone. */
export function computed(values: number[], i: number): number {
  if (values[i]) return 0;
  let m = ALL;
  for (const p of PEERS[i]) if (values[p]) m &= ~bit(values[p]);
  return m;
}

/** Candidates shown in the 3×3 candidate grid of a cell. */
export function shownCands(i: number): number {
  const { values, pencil, removed } = S.cur;
  if (values[i]) return 0;
  return S.settings.auto ? computed(values, i) & ~removed[i] : pencil[i];
}

/**
 * Candidates the engine reasons with. With auto-candidates on, that is what is shown.
 * Otherwise: a cell where the player wrote candidates uses those (so manual eliminations
 * count); a cell without any uses all possible digits. Pairs (centre marks) restrict too.
 */
export function engineCands(i: number): number {
  const { values, pencil, removed, centre } = S.cur;
  if (values[i]) return 0;
  let m = computed(values, i);
  if (!S.settings.auto && pencil[i]) m &= pencil[i];
  else m &= ~removed[i];
  if (centre[i]) m &= centre[i];
  return m;
}

export function engineGrid(): Grid {
  return new Grid(S.cur.values, S.cur.values.map((_, i) => engineCands(i)));
}
