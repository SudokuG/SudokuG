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
}

const KEY = "sudokug-lite-options";
const DEFAULTS: LiteOptions = { peers: true, same: true, mistakes: false, tidy: true, timer: true, stickyToggle: false };

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

export const LITE_OPTION_TEXT: { key: keyof LiteOptions; title: string; text?: string }[] = [
  { key: "peers", title: "Highlight row and column", text: "Shade the cells in the row and column of the selected cell." },
  { key: "same", title: "Highlight the same digit", text: "Mark digits equal to the one in the selected cell." },
  { key: "mistakes", title: "Highlight mistakes", text: "Mark an entry red as soon as it doesn't match the solution." },
  { key: "tidy", title: "Remove candidates automatically", text: "Placing a digit removes it from the candidates in its row and column." },
  { key: "timer", title: "Show timer" },
  { key: "stickyToggle", title: "S key stays on", text: "On a phone, the S key normally works only while you hold it. With this on, one tap switches it on and the next tap off." },
];
