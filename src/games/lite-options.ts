// Options for the lighter puzzle types: each type keeps its own (sudoku has its own too).

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
  /** Star Battle: smart input (drag or tap to cross, double tap for a star, hold to clear). */
  smart: boolean;
  /** Outline the selected cells. */
  outline: boolean;
}

/** The options as they were before each type had its own (read once, as a starting point). */
const OLD_KEY = "sudokug-lite-options";
const DEFAULTS: LiteOptions = {
  peers: true,
  same: true,
  mistakes: false,
  tidy: true,
  timer: true,
  stickyToggle: false,
  autoFinish: 8,
  numpadCands: false,
  toPlay: true,
  autoDots: true,
  smart: true,
  outline: true,
};

const read = (key: string): Partial<LiteOptions> => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") ?? {};
  } catch {
    return {};
  }
};

/** One puzzle type's options, kept per type in this browser. */
export interface LiteOptionStore {
  opt: LiteOptions;
  set<K extends keyof LiteOptions>(key: K, value: LiteOptions[K]): void;
  on(fn: () => void): void;
}

/**
 * The options of one puzzle type: its own saved choices, else the old shared ones, else the
 * type's defaults (`typeDefaults` win over the old shared choices: Star Battle starts with
 * auto-finish off whatever was set before).
 */
export function liteOptionsFor(id: string, typeDefaults: Partial<LiteOptions> = {}): LiteOptionStore {
  const key = `${OLD_KEY}-${id}`;
  const own = read(key);
  const opt: LiteOptions = { ...DEFAULTS, ...read(OLD_KEY), ...typeDefaults, ...own };
  const listeners: (() => void)[] = [];
  return {
    opt,
    set(k, value) {
      opt[k] = value;
      try {
        localStorage.setItem(key, JSON.stringify(opt));
      } catch {
        /* ignore */
      }
      for (const f of listeners) f();
    },
    on: (fn) => void listeners.push(fn),
  };
}

export const AUTO_FINISH_CHOICES = [0, 5, 8, 12];

/** Which puzzle types an option is for: with candidates, with automatic dots, with smart input (Star Battle). Unset: all. */
export type OptionFor = "candidates" | "autoDots" | "smart";

export const LITE_OPTION_TEXT: { key: Exclude<keyof LiteOptions, "autoFinish">; title: string; text?: string; for?: OptionFor }[] = [
  { key: "peers", title: "Highlight row and column", text: "Shade the cells in the row and column of the selected cell." },
  { key: "same", title: "Highlight the same digit", text: "Mark digits equal to the one in the selected cell, and lightly mark the cells that have it as a candidate (with that candidate picked out).", for: "candidates" },
  { key: "autoDots", title: "Cross automatically", text: "Placing a star crosses the cells around it, and the rest of its row, column or region once that has all its stars. Taking the star away again removes those crosses.", for: "autoDots" },
  { key: "mistakes", title: "Highlight mistakes", text: "Mark an entry red as soon as it doesn't match the solution." },
  { key: "tidy", title: "Remove candidates automatically", text: "Placing a digit removes it from the candidates in its row and column.", for: "candidates" },
  { key: "timer", title: "Show timer" },
  { key: "stickyToggle", title: "S key stays on", text: "On a phone, the S key normally works only while you hold it. With this on, one tap switches it on and the next tap off." },
  { key: "numpadCands", title: "Keyboard number pad enters candidates", text: "The number pad on the right of a keyboard always enters candidates (it never overwrites a digit); the digits above the letters enter digits. Off: both work the same.", for: "candidates" },
  { key: "toPlay", title: "Go to Play after making a puzzle", text: "Switch to the Play tab as soon as a new puzzle is ready." },
  {
    key: "smart",
    title: "Smart input",
    text: "Tap or drag over cells to cross them, double-tap (double-click) for a star, hold (or right-click) to clear. Hold S or Shift to select cells instead, then use the star and cross keys; tap outside the grid to drop the selection.",
    for: "smart",
  },
  { key: "outline", title: "Outline the selected cells", text: "A rounded frame around the selected cells (the shading stays either way)." },
];
