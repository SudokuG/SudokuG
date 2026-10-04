// Stats kept in this browser: puzzles solved and best times per difficulty, and which
// daily puzzles are done. Nothing leaves the device.

const STATS_KEY = "sudokug-stats";

export interface CategoryStats {
  solved: number;
  /** Solved without asking for a hint. */
  clean: number;
  /** Best time (ms) of a game without hints, or null. */
  best: number | null;
  /** Total time (ms) over all solved games, for an average. */
  total: number;
}

export interface Stats {
  v: 1;
  byCategory: Record<string, CategoryStats>;
  /** Finished dailies: "2026-10-04/Hard" -> time in ms. */
  daily: Record<string, number>;
}

const empty = (): Stats => ({ v: 1, byCategory: {}, daily: {} });

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw);
    if (s?.v !== 1 || typeof s.byCategory !== "object" || typeof s.daily !== "object") return empty();
    return s;
  } catch {
    return empty();
  }
}

function saveStats(s: Stats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export interface SolveRecord {
  category: string;
  time: number;
  hints: number;
  daily?: { date: string; difficulty: string } | null;
}

/** Store a finished game. Returns whether it set a new best time. */
export function addSolve(r: SolveRecord): { stats: Stats; newBest: boolean } {
  const s = loadStats();
  const c = (s.byCategory[r.category] ??= { solved: 0, clean: 0, best: null, total: 0 });
  c.solved++;
  c.total += r.time;
  let newBest = false;
  if (r.hints === 0) {
    c.clean++;
    if (c.best === null || r.time < c.best) {
      newBest = c.best !== null || c.clean === 1;
      c.best = r.time;
    }
  }
  if (r.daily) {
    const key = `${r.daily.date}/${r.daily.difficulty}`;
    if (!(key in s.daily) || r.time < s.daily[key]) s.daily[key] = r.time;
  }
  saveStats(s);
  return { stats: s, newBest };
}

export function resetStats(): void {
  saveStats(empty());
}
