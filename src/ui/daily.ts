// Daily puzzles: the same five puzzles for everyone on a given (local) date.
import { DIFFICULTIES } from "../engine";
import { DAILY, DAILY_START } from "../daily-data";

/**
 * Hand-crafted puzzles used with permission, shown with "By <author>". They replace the
 * generated puzzle of that day and difficulty. Key: "YYYY-MM-DD/Difficulty".
 */
export const HANDCRAFTED: Record<string, { code: string; author: string }> = {};

/** Today's date in the player's own time zone, as YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The daily puzzle code (and author, if hand-crafted) for a date and difficulty. */
export function dailyPuzzle(date: string, difficulty: string): { code: string; author: string } | null {
  const special = HANDCRAFTED[`${date}/${difficulty}`];
  if (special) return special;
  const index = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${DAILY_START}T12:00:00Z`)) / 86400000);
  const row = DAILY[index];
  const k = DIFFICULTIES.indexOf(difficulty as (typeof DIFFICULTIES)[number]);
  if (!row || k < 0) return null;
  return { code: row.split(" ")[k], author: "" };
}

export function formatDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}
