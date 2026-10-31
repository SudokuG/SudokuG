// Which puzzle type is on screen. Sudoku has the full app (app.ts); the lighter puzzle
// types live in src/games/<type>/ and are made on the spot when you ask for one.
// The choice is remembered in this browser; a puzzle link opens its own type.

export type GameId = "sudoku" | "sums" | "futoshiki";

export interface GameInfo {
  id: GameId;
  /** Shown in the game switcher. */
  title: string;
}

export const GAMES: GameInfo[] = [
  { id: "sudoku", title: "Sudoku" },
  { id: "sums", title: "Treasure Map" },
  { id: "futoshiki", title: "Futoshiki" },
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
  document.querySelectorAll<HTMLButtonElement>("#game-pick button").forEach((b) => {
    const on = b.dataset.game === g;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  for (const f of listeners) f(g);
}

/** Build the switcher in the header and show the current game. */
export function initGamePicker(): void {
  const nav = document.getElementById("game-pick")!;
  nav.replaceChildren(
    ...GAMES.map((g) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.game = g.id;
      b.textContent = g.title;
      b.addEventListener("click", () => setGame(g.id));
      return b;
    }),
  );
  setGame(current);
}
