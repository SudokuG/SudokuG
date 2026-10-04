// Engine tests: every step the logical solver takes must agree with the
// brute-force solution, on both solve paths used by the rating.
// Run with: npm test            (N=300 random puzzles)
//           N=3000 npm test     (more puzzles, also prints grind statistics)
import {
  DIFFICULTIES,
  Grid,
  PATTERN_FIRST,
  decodePuzzle,
  encodePuzzle,
  generatePuzzle,
  generateRatedSync,
  logicalSolve,
  ratePuzzle,
  seededRandom,
  uniqueSolution,
  TECHNIQUES,
  TEMPLATES,
  hardestGroup,
  templateOf,
} from "../src/engine";
import type { Rating, Technique } from "../src/engine";
import { SAMPLES } from "../src/samples";
import { GUIDE } from "../src/guide";
import { exampleStep } from "../src/guide-step";
import { DAILY, DAILY_START } from "../src/daily-data";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error("FAIL:", msg);
};

function verifyPath(label: string, g: Grid, solution: number[], techniques?: Technique[]) {
  const log = logicalSolve(g, techniques);
  for (const s of log.steps) {
    for (const p of s.placements)
      if (solution[p.cell] !== p.digit) fail(`${label}: ${s.technique} placed ${p.digit} at ${p.cell}, solution has ${solution[p.cell]}`);
    for (const e of s.eliminations)
      if (solution[e.cell] === e.digit) fail(`${label}: ${s.technique} removed the correct digit ${e.digit} at ${e.cell}`);
  }
  if (log.solved && log.final.values.join("") !== solution.join("")) fail(`${label}: logical solution differs from brute force`);
  return log;
}

function checkPuzzle(label: string, puzzle: string): Rating | undefined {
  const g = Grid.fromString(puzzle);
  const solution = uniqueSolution(g.values);
  if (!solution) {
    fail(`${label}: puzzle does not have a unique solution`);
    return;
  }
  const easy = verifyPath(label, g, solution);
  const pattern = verifyPath(label + " (patterns first)", g, solution, PATTERN_FIRST);
  if (easy.solved !== pattern.solved) fail(`${label}: the two solve paths disagree on whether the puzzle is solvable`);
  const r = ratePuzzle(g);
  for (const f of r.forced) {
    if (f.kind !== "subset" || f.emptyInUnit === undefined) continue;
    const size = f.technique.endsWith("Quad") ? 4 : 3;
    // A subset of size n in a unit with fewer than 2n empty cells has a smaller mirror subset,
    // which the engine tries first. So this should never happen.
    if (f.emptyInUnit < 2 * size) fail(`${label}: ${f.technique} reported in a unit with only ${f.emptyInUnit} empty cells`);
  }
  return r;
}

const fmt = (r: Rating) =>
  `${r.difficulty.padEnd(8)} hardest=${(r.hardest?.technique ?? "-").padEnd(28)} grind=${r.grind}` +
  (r.forced.length ? ` (${r.forced.map((f) => f.technique).join(", ")})` : "");

// 1. Built-in samples.
for (const s of SAMPLES) {
  const r = checkPuzzle(s.name, s.puzzle);
  if (r) console.log(`${s.name.padEnd(11)} ${fmt(r)}`);
}

// 2. Random puzzles.
const N = Number(process.env.N ?? 300);
const byHardest: Record<string, { level: number; puzzles: string[] }> = {};
const byDifficulty: Record<string, number> = {};
const byGrind: Record<string, number> = { clean: 0, light: 0, heavy: 0 };
const forcedBy: Record<string, number> = {};
const grindyExamples: Record<string, string[]> = { light: [], heavy: [] };
let hardPlus = 0;
let hardPlusGrindy = 0;
let usedGrind = 0;
let usedButAvoidable = 0;
for (let seed = 1; seed <= N; seed++) {
  const { puzzle } = generatePuzzle(seededRandom(seed));
  const str = puzzle.map((v) => v || ".").join("");
  const r = checkPuzzle(`seed ${seed}`, str);
  if (!r) continue;
  const key = r.solved ? r.hardest!.technique : "STUCK";
  (byHardest[key] ??= { level: r.solved ? r.hardest!.level : 99, puzzles: [] }).puzzles.push(str);
  byDifficulty[r.difficulty] = (byDifficulty[r.difficulty] ?? 0) + 1;
  if (!r.solved) continue;
  byGrind[r.grind]++;
  if (r.grind !== "clean" && grindyExamples[r.grind].length < 3)
    grindyExamples[r.grind].push(`${str}  ${r.difficulty}, ${r.forced.map((f) => `${f.technique} ${f.kind === "subset" ? "in" : ""} ${f.where}`).join("; ")}`);
  if (!["Easy", "Medium"].includes(r.difficulty)) {
    hardPlus++;
    if (r.grind !== "clean") hardPlusGrindy++;
  }
  for (const f of r.forced) forcedBy[f.technique] = (forcedBy[f.technique] ?? 0) + 1;
  if (r.grindOnEasiestPath) {
    usedGrind++;
    if (!r.forced.length) usedButAvoidable++;
  }
}
const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;
console.log(`\nHardest technique needed, over ${N} random puzzles:`);
for (const [t, v] of Object.entries(byHardest).sort((a, b) => a[1].level - b[1].level))
  console.log(`  ${t.padEnd(30)} ${String(v.puzzles.length).padStart(5)}   e.g. ${v.puzzles.slice(0, Number(process.env.EX ?? 1)).join("  ")}`);
console.log(`\nDifficulty: ${Object.entries(byDifficulty).map(([k, v]) => `${k} ${pct(v, N)}`).join(", ")}`);
const solved = byGrind.clean + byGrind.light + byGrind.heavy;
console.log(`Grind (of ${solved} solvable): clean ${pct(byGrind.clean, solved)}, light ${pct(byGrind.light, solved)}, heavy ${pct(byGrind.heavy, solved)}`);
console.log(`Grindy among Hard or harder puzzles: ${hardPlusGrindy} of ${hardPlus} (${pct(hardPlusGrindy, hardPlus)})`);
for (const k of ["light", "heavy"]) for (const e of grindyExamples[k]) console.log(`  ${k.padEnd(5)} ${e}`);
console.log(`Easiest-first path uses a grindy move in ${usedGrind} puzzles; in ${usedButAvoidable} of them it was avoidable.`);
console.log(`Forced grind by technique: ${JSON.stringify(forcedBy)}`);

// 3. Puzzle codes: round trip for symmetric and non-symmetric puzzles.
for (let seed = 1; seed <= 300; seed++) {
  const { puzzle, solution } = generatePuzzle(seededRandom(seed), seed % 2 === 0);
  const variants = [puzzle, solution, new Array(81).fill(0), puzzle.map((v, i) => (i === seed % 81 ? 0 : v))];
  for (const v of variants) {
    const code = encodePuzzle(v);
    if (decodePuzzle(code).join("") !== v.join("")) fail(`code round trip failed for ${v.join("")} (${code})`);
  }
}
const sampleCodes = SAMPLES.map((s) => encodePuzzle(Grid.fromString(s.puzzle).values).length);
console.log(`\nPuzzle codes: ${Math.min(...sampleCodes)}-${Math.max(...sampleCodes)} characters for the samples.`);

// 4. Generator: each template gives a puzzle that the template's techniques solve,
//    that needs a technique from the template's hardest group, and that has one solution.
for (const g of DIFFICULTIES) {
  const must = new Set(hardestGroup(TEMPLATES[g]).names);
  const allowed = TECHNIQUES.filter((t) => TEMPLATES[g].includes(t.name));
  for (let k = 1; k <= 3; k++) {
    const t0 = Date.now();
    const r = generateRatedSync({ allowed: TEMPLATES[g] }, seededRandom(1000 * k + g.length));
    const log = logicalSolve(new Grid(r.puzzle), allowed);
    if (!log.solved) fail(`generator: ${g} puzzle not solvable with the ${g} techniques`);
    if (!log.steps.some((s) => must.has(s.technique))) fail(`generator: ${g} puzzle doesn't need a ${g} technique`);
    if (!uniqueSolution(r.puzzle)) fail(`generator: ${g} puzzle has no unique solution`);
    if (k === 1)
      console.log(`Generated ${g.padEnd(8)} in ${String(Date.now() - t0).padStart(4)} ms after ${String(r.attempts).padStart(3)} tries: ${encodePuzzle(r.puzzle)}  rated ${r.rating.difficulty}, ${r.rating.grind}`);
  }
}
// A custom profile: Hard template without X-Wing but with XY-Wing.
{
  const allowed = [...TEMPLATES.Hard.filter((n) => n !== "X-Wing"), "XY-Wing"];
  const r = generateRatedSync({ allowed }, seededRandom(77));
  const log = logicalSolve(new Grid(r.puzzle), TECHNIQUES.filter((t) => allowed.includes(t.name) || t.level <= 1));
  if (!log.solved || !log.steps.some((s) => s.technique === "XY-Wing")) fail("generator: custom profile not respected");
  console.log(`Custom profile (Hard − X-Wing + XY-Wing): ${r.attempts} tries, template ${templateOf(allowed) ?? "none"}`);
}

// 5. Techniques section: every entry has an example that shows exactly that technique,
//    and the example's deduction agrees with the solution of its position.
for (const entry of GUIDE) {
  const ex = exampleStep(entry.name);
  if (!ex) {
    fail(`guide: no example for ${entry.name}`);
    continue;
  }
  if (ex.step.technique !== entry.name) fail(`guide: example for ${entry.name} shows ${ex.step.technique}`);
  const sol = uniqueSolution(ex.grid.values);
  if (sol) {
    for (const e of ex.step.eliminations) if (sol[e.cell] === e.digit) fail(`guide: ${entry.name} example removes a correct digit`);
    for (const p of ex.step.placements) if (sol[p.cell] !== p.digit) fail(`guide: ${entry.name} example places a wrong digit`);
  }
}
console.log(`Techniques section: ${GUIDE.length} entries checked.`);

// 6. Daily puzzles: every code decodes, has one solution and fits its template.
{
  let checked = 0;
  DAILY.forEach((row, day) => {
    const codes = row.split(" ");
    if (codes.length !== DIFFICULTIES.length) fail(`daily ${day}: expected ${DIFFICULTIES.length} codes`);
    codes.forEach((code, k) => {
      const g = DIFFICULTIES[k];
      const values = decodePuzzle(code);
      if (!uniqueSolution(values)) fail(`daily ${day}/${g}: no unique solution`);
      const log = logicalSolve(new Grid(values), TECHNIQUES.filter((t) => TEMPLATES[g].includes(t.name)));
      if (!log.solved) fail(`daily ${day}/${g}: not solvable with the ${g} techniques`);
      checked++;
    });
  });
  const end = new Date(`${DAILY_START}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + DAILY.length - 1);
  const daysLeft = Math.round((end.getTime() - Date.now()) / 86400000);
  console.log(`Daily puzzles: ${checked} checked, available until ${end.toISOString().slice(0, 10)} (${daysLeft} days from now).`);
  if (daysLeft < 60) console.warn("WARNING: fewer than 60 days of daily puzzles left. Run `npm run dailies` with a later START.");
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll checks passed.");
