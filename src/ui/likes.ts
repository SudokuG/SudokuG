// Puzzles the player liked, kept in this browser. Each one can be opened again from the
// Puzzles tab. (Sharing likes with other players would need a server; see README.)

const LIKES_KEY = "sudokug-likes";

export interface Liked {
  /** Puzzle code (short form, also used in links). */
  code: string;
  /** What it was: "Daily Hard", "Expert", "Shared", ... */
  label: string;
  /** Solving time in ms, if it was finished. */
  time: number | null;
  /** When it was liked (ms since 1970). */
  at: number;
}

interface LikeFile {
  v: 1;
  /** Keyed by the 81-character puzzle. */
  puzzles: Record<string, Liked>;
}

function read(): LikeFile {
  try {
    const f = JSON.parse(localStorage.getItem(LIKES_KEY) ?? "null");
    if (f?.v === 1 && f.puzzles && typeof f.puzzles === "object") return f;
  } catch {
    /* unreadable: start fresh */
  }
  return { v: 1, puzzles: {} };
}

function write(f: LikeFile): void {
  try {
    localStorage.setItem(LIKES_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

export const isLiked = (puzzle: string): boolean => !!read().puzzles[puzzle];

/** Like or unlike a puzzle. Returns whether it is liked now. */
export function toggleLike(puzzle: string, info: Omit<Liked, "at">): boolean {
  const f = read();
  if (f.puzzles[puzzle]) delete f.puzzles[puzzle];
  else f.puzzles[puzzle] = { ...info, at: Date.now() };
  write(f);
  return !!f.puzzles[puzzle];
}

/** Liked puzzles, most recent first. */
export function likedList(): (Liked & { puzzle: string })[] {
  const f = read();
  return Object.entries(f.puzzles)
    .map(([puzzle, l]) => ({ puzzle, ...l }))
    .sort((a, b) => b.at - a.at);
}
