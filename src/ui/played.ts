// Which puzzles were played in this browser, so the puzzle library hands out new ones.
// Also a random id for this browser, sent along when you share your likes, so the same
// like isn't counted twice. Nothing here leaves the device unless you copy it yourself.

const PLAYED_KEY = "sudokug-played";
const ID_KEY = "sudokug-id";
/** Oldest entries are dropped beyond this (about 30 KB). */
const MAX_PLAYED = 1500;

function read(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem(PLAYED_KEY) ?? "[]");
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Puzzle codes played here. */
export const playedSet = (): Set<string> => new Set(read());

export function markPlayed(code: string): void {
  if (!code) return;
  const a = read().filter((c) => c !== code);
  a.push(code);
  try {
    localStorage.setItem(PLAYED_KEY, JSON.stringify(a.slice(-MAX_PLAYED)));
  } catch {
    /* ignore */
  }
}

/** A random id for this browser (not linked to you in any way). */
export function browserId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 8);
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}
