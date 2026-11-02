// Options for the lighter puzzle types (shared by all of them; sudoku has its own).

export interface LiteOptions {
  /** Shade the row and column of the selected cell. */
  peers: boolean;
  /** Mark the same digit elsewhere. */
  same: boolean;
  /** Mark a wrong entry as soon as it is made. */
  mistakes: boolean;
  /** Placing a digit removes it from the candidates in its row and column. */
  tidy: boolean;
  timer: boolean;
  /** Phone S key: stays on until tapped again (instead of only while held). */
  stickyToggle: boolean;
  /** Fill in the rest when at most this many cells are left and it follows from singles (0 = off). */
  autoFinish: number;
  /** The keyboard's number pad enters candidates. */
  numpadCands: boolean;
  /** After making a new puzzle, switch to the Play tab. */
  toPlay: boolean;
  /** Star Battle: a star dots the cells around it, and full rows, columns and regions. */
  autoDots: boolean;
}

const KEY = "sudokug-lite-options";
const DEFAULTS: LiteOptions = { peers: true, same: true, mistakes: false, tidy: true, timer: true, stickyToggle: false, autoFinish: 8, numpadCands: false, toPlay: true, autoDots: true };

function load(): LiteOptions {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export const liteOptions: LiteOptions = load();
const listeners: (() => void)[] = [];

export function onLiteOptions(fn: () => void): void {
  listeners.push(fn);
}

export function setLiteOption<K extends keyof LiteOptions>(key: K, value: LiteOptions[K]): void {
  liteOptions[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(liteOptions));
  } catch {
    /* ignore */
  }
  for (const f of listeners) f();
}

export const AUTO_FINISH_CHOICES = [0, 5, 8, 12];

/** Which puzzle types an option is for: those with candidates, or those with automatic dots (Star Battle). Unset: all. */
export type OptionFor = "candidates" | "autoDots";

export const LITE_OPTION_TEXT: { key: Exclude<keyof LiteOptions, "autoFinish">; title: string; text?: string; for?: OptionFor }[] = [
  { key: "peers", title: "Highlight row and column", text: "Shade the cells in the row and column of the selected cell." },
  { key: "same", title: "Highlight the same digit", text: "Mark digits equal to the one in the selected cell, and lightly mark the cells that have it as a candidate (with that candidate picked out).", for: "candidates" },
  { key: "autoDots", title: "Dot automatically", text: "Placing a star dots the cells around it, and the rest of its row, column or region once that has all its stars. Taking the star away again removes those dots.", for: "autoDots" },
  { key: "mistakes", title: "Highlight mistakes", text: "Mark an entry red as soon as it doesn't match the solution." },
  { key: "tidy", title: "Remove candidates automatically", text: "Placing a digit removes it from the candidates in its row and column.", for: "candidates" },
  { key: "timer", title: "Show timer" },
  { key: "stickyToggle", title: "S key stays on", text: "On a phone, the S key normally works only while you hold it. With this on, one tap switches it on and the next tap off." },
  { key: "numpadCands", title: "Keyboard number pad enters candidates", text: "The number pad on the right of a keyboard always enters candidates (it never overwrites a digit); the digits above the letters enter digits. Off: both work the same.", for: "candidates" },
  { key: "toPlay", title: "Go to Play after making a puzzle", text: "Switch to the Play tab as soon as a new puzzle is ready." },
];
