// Adds shared likes to the library. Players copy their likes in the Puzzles tab ("Copy my
// likes") and send the text; paste one or more of those into a file and run:
//   npm run add-likes -- likes.txt
// Each block starts with "SudokuG likes <id>"; a browser's like counts once per puzzle.
// A liked puzzle that fits a template (solvable with its techniques, rated that
// difficulty) is also added to the library for that difficulty.
import { readFileSync } from "node:fs";
import { DIFFICULTIES, Grid, TECHNIQUES, TEMPLATES, decodePuzzle, logicalSolve, ratePuzzle, uniqueSolution } from "../src/engine";
import { LIBRARY, LIKES } from "../src/library-data";
import { writeLibrary } from "./common";

const file = process.argv[2];
if (!file) throw new Error("Usage: npm run add-likes -- <file with copied likes>");
const library: Record<string, string[]> = Object.fromEntries(DIFFICULTIES.map((g) => [g, [...(LIBRARY[g] ?? [])]]));
const likes: Record<string, string[]> = Object.fromEntries(Object.entries(LIKES).map(([c, ids]) => [c, [...ids]]));
const inLibrary = new Set(Object.values(library).flat());

let id = "unknown";
let added = 0;
let newLikes = 0;
for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  const head = /^SudokuG likes (\S+)/.exec(line);
  if (head) {
    id = head[1];
    continue;
  }
  if (!/^[SA][0-9A-Za-z]+$/.test(line)) continue;
  let values: number[];
  try {
    values = decodePuzzle(line);
  } catch {
    console.warn(`Skipped ${line}: not a puzzle code.`);
    continue;
  }
  if (!uniqueSolution(values)) {
    console.warn(`Skipped ${line}: no unique solution.`);
    continue;
  }
  const ids = (likes[line] ??= []);
  if (!ids.includes(id)) {
    ids.push(id);
    newLikes++;
  }
  if (inLibrary.has(line)) continue;
  const g = ratePuzzle(new Grid(values)).difficulty;
  const tech = TECHNIQUES.filter((t) => (TEMPLATES as Record<string, string[]>)[g]?.includes(t.name));
  if (tech.length && logicalSolve(new Grid(values), tech).solved) {
    library[g].unshift(line);
    inLibrary.add(line);
    added++;
    console.log(`Added ${line} to the ${g} library.`);
  } else console.log(`${line} (${g}) doesn't fit a template: like recorded, not in the library.`);
}
writeLibrary(library, likes);
console.log(`${newLikes} new like${newLikes === 1 ? "" : "s"}, ${added} puzzle${added === 1 ? "" : "s"} added to the library.`);
