// Fills the puzzle library (src/library-data.ts) with good puzzles per difficulty, so
// "Generate" can hand one out at once. Existing puzzles and likes are kept; this only adds
// puzzles until each difficulty has COUNT of them.
// Run: npm run library     (COUNTS="Easy=80,Medium=80,Hard=150,Expert=150,Extreme=150", WORKERS=2)
import { DIFFICULTIES, seededRandom } from "../src/engine";
import type { Group } from "../src/engine";
import { LIBRARY, LIKES } from "../src/library-data";
import { goodPuzzle, parallel, writeLibrary } from "./common";

const COUNTS: Record<string, number> = Object.fromEntries(
  (process.env.COUNTS ?? "Easy=80,Medium=80,Hard=150,Expert=150,Extreme=150").split(",").map((kv) => {
    const [k, v] = kv.split("=");
    return [k, Number(v)];
  }),
);
const WORKERS = Number(process.env.WORKERS ?? 2);
const seedOf = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 2166136261);

// The jobs: one per puzzle still to make, seeded by difficulty and position.
const jobs: { g: Group; k: number }[] = [];
for (const g of DIFFICULTIES) for (let k = (LIBRARY[g] ?? []).length; k < (COUNTS[g] ?? 0); k++) jobs.push({ g, k });
if (!process.env.POOL_PART) console.log(`Making ${jobs.length} puzzles with ${WORKERS} workers.`);

parallel(jobs.length, (i) => goodPuzzle(jobs[i].g, seededRandom(seedOf(`library/${jobs[i].g}/${jobs[i].k}`))), WORKERS, "puzzles").then((made) => {
  const library: Record<string, string[]> = Object.fromEntries(DIFFICULTIES.map((g) => [g, [...(LIBRARY[g] ?? [])]]));
  const seen = new Set(Object.values(library).flat());
  let short = 0;
  made.forEach((p, i) => {
    if (p.missing) short++;
    if (p.missing || seen.has(p.code)) return; // only puzzles that meet the requirements
    seen.add(p.code);
    library[jobs[i].g].push(p.code);
  });
  writeLibrary(library, LIKES);
  console.log(`Library: ${DIFFICULTIES.map((g) => `${g} ${library[g].length}`).join(", ")}. Left out ${short} that fell short.`);
});
