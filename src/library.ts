// The puzzle pool behind "Generate" and printing: good puzzles found ahead of time
// (scripts/grow.ts, scripts/make-library.ts), puzzles players liked (scripts/add-likes.ts),
// and daily puzzles you missed. It hands out one you haven't played yet before a new one
// is made in the browser.
//
// Order: liked puzzles (most likes first), then a random one from the library and your
// missed dailies, then the older puzzles in OLD_LIBRARY (made by the generator before the
// current recipes; the generator retires one of them for every new puzzle it adds).
import { DIFFICULTIES, Grid, TECHNIQUES, decodePuzzle, hardestGroup, logicalSolve } from "./engine";
import { DAILY, DAILY_START } from "./daily-data";
import { LIBRARY, LIKES, OLD_LIBRARY } from "./library-data";

/** Missed dailies count from this day on: earlier days were made by the old generator. */
export const MISSED_FROM = "2026-11-02";

export interface LibraryPick {
  code: string;
  likes: number;
  /** Unplayed puzzles left for this difficulty after this one. */
  left: number;
  /** Where it came from. */
  source: "library" | "daily" | "old";
}

const likesOf = (code: string) => LIKES[code]?.length ?? 0;
const dayIndex = (date: string) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${DAILY_START}T12:00:00Z`)) / 86400000);

/** Daily puzzles of a difficulty from MISSED_FROM up to (not including) `today`. */
export function pastDailies(difficulty: string, today: string): string[] {
  const k = DIFFICULTIES.indexOf(difficulty as (typeof DIFFICULTIES)[number]);
  if (k < 0) return [];
  const out: string[] = [];
  for (let i = Math.max(0, dayIndex(MISSED_FROM)); i < Math.min(DAILY.length, dayIndex(today)); i++) out.push(DAILY[i].split(" ")[k]);
  return out;
}

/**
 * An unplayed puzzle of this difficulty, or null when you have played them all.
 * `played` holds puzzle codes; `today` is the player's local date (YYYY-MM-DD).
 */
export function pickFromLibrary(difficulty: string, played: Set<string>, today: string, rnd: () => number = Math.random): LibraryPick | null {
  const lib = (LIBRARY[difficulty] ?? []).filter((c) => !played.has(c));
  const daily = pastDailies(difficulty, today).filter((c) => !played.has(c));
  const old = (OLD_LIBRARY[difficulty] ?? []).filter((c) => !played.has(c));
  const left = lib.length + daily.length + old.length - 1;
  const liked = lib.filter((c) => likesOf(c) > 0).sort((a, b) => likesOf(b) - likesOf(a));
  if (liked.length) return { code: liked[0], likes: likesOf(liked[0]), left, source: "library" };
  const fresh = [...lib, ...daily];
  if (fresh.length) {
    const code = fresh[Math.floor(rnd() * fresh.length)];
    return { code, likes: likesOf(code), left, source: lib.includes(code) ? "library" : "daily" };
  }
  if (old.length) {
    const code = old[Math.floor(rnd() * old.length)];
    return { code, likes: 0, left, source: "old" };
  }
  return null;
}

/** Puzzles in the library for a difficulty (new and old). */
export const librarySize = (difficulty: string) => (LIBRARY[difficulty] ?? []).length + (OLD_LIBRARY[difficulty] ?? []).length;

/**
 * Look through the pool for an unplayed puzzle that fits a custom mix of techniques: it can
 * be solved with only those techniques and needs at least one from the hardest group that
 * is ticked (the same rule the generator uses). Solving every puzzle takes time, so this is
 * a generator that yields every ~20 ms; it gives up after `budgetMs` and returns null.
 */
export function* findForProfile(allowedNames: string[], played: Set<string>, today: string, budgetMs = 1500, rnd: () => number = Math.random): Generator<number, string | null> {
  const t0 = performance.now();
  const allowedSet = new Set([...allowedNames, ...TECHNIQUES.filter((t) => t.level <= 1).map((t) => t.name)]);
  const allowed = TECHNIQUES.filter((t) => allowedSet.has(t.name));
  const { group, names } = hardestGroup(allowedSet);
  const must = new Set(names);
  // The puzzles most likely to fit: those of the hardest ticked group and its neighbours.
  const gi = DIFFICULTIES.indexOf(group);
  const groups = DIFFICULTIES.filter((_, i) => Math.abs(i - gi) <= 1);
  const pool = groups.flatMap((g) => [...(LIBRARY[g] ?? []), ...pastDailies(g, today), ...(OLD_LIBRARY[g] ?? [])]).filter((c) => !played.has(c));
  let tried = 0;
  let since = performance.now();
  while (pool.length && performance.now() - t0 < budgetMs) {
    const k = Math.floor(rnd() * pool.length);
    const code = pool[k];
    pool[k] = pool[pool.length - 1];
    pool.pop();
    tried++;
    const log = logicalSolve(new Grid(decodePuzzle(code)), allowed);
    if (log.solved && log.steps.some((s) => must.has(s.technique))) return code;
    if (performance.now() - since > 20) {
      yield tried;
      since = performance.now();
    }
  }
  return null;
}
