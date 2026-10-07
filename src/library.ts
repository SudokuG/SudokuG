// The puzzle library: good puzzles found ahead of time (scripts/make-library.ts) and
// puzzles players liked (scripts/add-likes.ts). "Generate" hands out one you haven't
// played yet, most-liked first, before making a new one.
import { LIBRARY, LIKES } from "./library-data";

export interface LibraryPick {
  code: string;
  likes: number;
  /** Unplayed puzzles left for this difficulty after this one. */
  left: number;
}

const likesOf = (code: string) => LIKES[code]?.length ?? 0;

/** An unplayed library puzzle of this difficulty, or null when you have played them all. */
export function pickFromLibrary(difficulty: string, played: Set<string>, rnd: () => number = Math.random): LibraryPick | null {
  const all = LIBRARY[difficulty] ?? [];
  const fresh = all.filter((c) => !played.has(c));
  if (!fresh.length) return null;
  // Liked puzzles first, most likes first; otherwise a random one.
  const liked = fresh.filter((c) => likesOf(c) > 0).sort((a, b) => likesOf(b) - likesOf(a));
  const code = liked[0] ?? fresh[Math.floor(rnd() * fresh.length)];
  return { code, likes: likesOf(code), left: fresh.length - 1 };
}

export const librarySize = (difficulty: string) => (LIBRARY[difficulty] ?? []).length;
