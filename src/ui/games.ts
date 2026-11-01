// Which puzzle type is on screen. Sudoku has the full app (app.ts); the lighter puzzle
// types live in src/games/<type>/ and are made on the spot when you ask for one.
// The choice is remembered in this browser; a puzzle link opens its own type.

export type GameId = "sudoku" | "sums" | "futoshiki" | "calcudoku" | "starbattle";

export interface GameInfo {
  id: GameId;
  /** Shown in the game switcher. */
  title: string;
}

export const GAMES: GameInfo[] = [
  { id: "sudoku", title: "Sudoku" },
  { id: "sums", title: "Treasure Map" },
  { id: "futoshiki", title: "Futoshiki" },
  { id: "calcudoku", title: "Calcudoku" },
  { id: "starbattle", title: "Star Battle" },
];

const KEY = "sudokug-puzzle-type"; // ("sudokug-game" was the old sudoku save)

function load(): GameId {
  try {
    const g = localStorage.getItem(KEY);
    if (GAMES.some((x) => x.id === g)) return g as GameId;
  } catch {
    /* storage unavailable */
  }
  return "sudoku";
}

let current: GameId = load();
const listeners: ((g: GameId) => void)[] = [];

export const currentGame = (): GameId => current;

/** Run `fn` whenever another game is chosen. */
export function onGameChange(fn: (g: GameId) => void): void {
  listeners.push(fn);
}

/** Switch the page to another puzzle type. */
export function setGame(g: GameId): void {
  current = g;
  try {
    localStorage.setItem(KEY, g);
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.game = g;
  document.querySelectorAll<HTMLSelectElement>("select[data-type-select]").forEach((sel) => (sel.value = g));
  for (const f of listeners) f(g);
}

let pickers = 0;
/**
 * The puzzle-type dropdown, at the top of every Puzzles tab (fills each [data-type-pick]
 * element; the light puzzles' pages must be built first). Shows the current type.
 */
export function initGamePicker(): void {
  document.querySelectorAll<HTMLElement>("[data-type-pick]").forEach((box) => {
    if (box.querySelector("select")) return;
    const id = `type-pick-${++pickers}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = "Puzzle";
    const sel = document.createElement("select");
    sel.id = id;
    sel.dataset.typeSelect = "";
    for (const g of GAMES) sel.add(new Option(g.title, g.id));
    sel.addEventListener("change", () => setGame(sel.value as GameId));
    box.append(label, sel);
  });
  setGame(current);
}
