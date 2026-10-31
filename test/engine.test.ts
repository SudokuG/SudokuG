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
  judgeTemplate,
  RECIPES,
  missingOf,
  shapeOf,
  shapeOfSlow,
  logicalSolve,
  ratePuzzle,
  seededRandom,
  uniqueSolution,
  TECHNIQUES,
  TEMPLATES,
  hardestGroup,
  templateOf,
} from "../src/engine";
import type { Rating, Step, Technique } from "../src/engine";
import { SAMPLES } from "../src/samples";
import { GUIDE } from "../src/guide";
import { exampleStep } from "../src/guide-step";
import { DAILY, DAILY_START } from "../src/daily-data";
import { LIBRARY, LIKES, OLD_LIBRARY } from "../src/library-data";
import { SUMS_SIZES, cluesOf, decodeSums, encodeSums, generateSums, runSums, solveSums } from "../src/games/sums/engine";
import { puzzleName } from "../src/names";

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
//    (Hard and up get a few seconds each here; meeting the full recipe takes longer.)
for (const g of DIFFICULTIES) {
  const must = new Set(hardestGroup(TEMPLATES[g]).names);
  const allowed = TECHNIQUES.filter((t) => TEMPLATES[g].includes(t.name));
  for (let k = 1; k <= (RECIPES[g as keyof typeof RECIPES] ? 1 : 3); k++) {
    const t0 = Date.now();
    const r = generateRatedSync({ allowed: TEMPLATES[g], timeBudgetMs: 4000 }, seededRandom(1000 * k + g.length));
    const log = logicalSolve(new Grid(r.puzzle), allowed);
    if (!log.solved) fail(`generator: ${g} puzzle not solvable with the ${g} techniques`);
    if (!log.steps.some((s) => must.has(s.technique))) fail(`generator: ${g} puzzle doesn't need a ${g} technique`);
    if (!uniqueSolution(r.puzzle)) fail(`generator: ${g} puzzle has no unique solution`);
    if (r.rating.difficulty !== g) fail(`generator: ${g} puzzle rated ${r.rating.difficulty}`);
    const j = judgeTemplate(r.puzzle, g);
    if (j && (j.shape.expert > (RECIPES[g as keyof typeof RECIPES].expertMax ?? Infinity) || j.shape.top > RECIPES[g as keyof typeof RECIPES].top[1]))
      fail(`generator: ${g} puzzle has more of the hardest moves than its recipe allows`);
    if (k === 1)
      console.log(
        `Generated ${g.padEnd(8)} in ${String(Date.now() - t0).padStart(4)} ms after ${String(r.attempts).padStart(4)} tries: ${encodePuzzle(r.puzzle)}  rated ${r.rating.difficulty}, ${r.rating.grind}, ${JSON.stringify(r.shape)} (${r.missing} missing)`,
      );
  }
}
// The fast shape (all singles in one pass) must match the step-by-step solver exactly.
{
  let compared = 0;
  for (const g of ["Hard", "Expert", "Extreme"] as const) {
    const allowed = TECHNIQUES.filter((t) => TEMPLATES[g].includes(t.name));
    for (let seed = 1; seed <= 40; seed++) {
      const p = generatePuzzle(seededRandom(seed * 31 + g.length)).puzzle;
      const a = shapeOf(p, allowed, g);
      const b = shapeOfSlow(p, allowed, g);
      const key = (s: typeof a) => [s.solved, s.hard, s.hiddenPairs, s.nakedPairs, s.top, s.expert, s.extreme, s.locks, s.opening, s.steps.map((x) => x.technique + JSON.stringify(x.eliminations)).join()].join("|");
      if (key(a) !== key(b)) fail(`shape: fast and step-by-step solves differ for ${encodePuzzle(p)} (${g})`);
      compared++;
    }
  }
  console.log(`Shapes: fast and step-by-step solves agree on ${compared} puzzles.`);
}
// Recipe arithmetic.
{
  const base = { solved: true, clues: 25, hard: 3, hiddenPairs: 2, nakedPairs: 0, top: 1, expert: 1, extreme: 0, locks: 2, opening: 0, steps: [], final: [] };
  if (missingOf(base, RECIPES.Expert) !== 0) fail("recipe: a puzzle with everything should miss nothing");
  if (missingOf({ ...base, hiddenPairs: 0 }, RECIPES.Expert) !== 3) fail("recipe: no hidden pairs should miss 2 pattern moves and 1 hidden pair");
  if (missingOf({ ...base, clues: 28 }, RECIPES.Expert) !== 2) fail("recipe: 2 clues too many should miss 2");
}
// A custom profile: Hard template without X-Wing but with XY-Wing.
{
  const allowed = [...TEMPLATES.Hard.filter((n) => n !== "X-Wing"), "XY-Wing"];
  const r = generateRatedSync({ allowed, timeBudgetMs: 3000 }, seededRandom(77));
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
const RECIPE_FROM = Math.round((Date.parse("2026-11-02T12:00:00Z") - Date.parse(`${DAILY_START}T12:00:00Z`)) / 86400000);
{
  let checked = 0;
  let short = 0;
  DAILY.forEach((row, day) => {
    const codes = row.split(" ");
    if (codes.length !== DIFFICULTIES.length) fail(`daily ${day}: expected ${DIFFICULTIES.length} codes`);
    codes.forEach((code, k) => {
      const g = DIFFICULTIES[k];
      const values = decodePuzzle(code);
      if (!uniqueSolution(values)) fail(`daily ${day}/${g}: no unique solution`);
      const log = logicalSolve(new Grid(values), TECHNIQUES.filter((t) => TEMPLATES[g].includes(t.name)));
      if (!log.solved) fail(`daily ${day}/${g}: not solvable with the ${g} techniques`);
      // Counted, not failed: dailies the generator hasn't replaced with recipe puzzles yet.
      const j = day >= RECIPE_FROM ? judgeTemplate(values, g) : null;
      if (j && !j.fits) short++;
      checked++;
    });
  });
  const end = new Date(`${DAILY_START}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + DAILY.length - 1);
  const daysLeft = Math.round((end.getTime() - Date.now()) / 86400000);
  console.log(`Daily puzzles: ${checked} checked, available until ${end.toISOString().slice(0, 10)} (${daysLeft} days from now).`);
  if (short) console.log(`  ${short} Hard/Expert/Extreme dailies from 2026-11-02 don't meet their recipe yet (the generator app replaces them).`);
  if (daysLeft < 60) console.warn("WARNING: fewer than 60 days of daily puzzles left. Run `npm run dailies` with a later START.");
}

// 7. Puzzle library: every code is a valid puzzle with one solution, listed once, fits its
//    template; generated ones have all the required moves. Liked codes decode.
{
  const seen = new Set<string>();
  let checked = 0;
  let short = 0;
  const lists: [string, string, string[]][] = [...Object.entries(LIBRARY).map(([g, c]) => ["new", g, c] as [string, string, string[]]), ...Object.entries(OLD_LIBRARY).map(([g, c]) => ["old", g, c] as [string, string, string[]])];
  // Old puzzles are many: check a sample of them (all with FULL=1).
  const full = !!process.env.FULL;
  for (const [kind, g, all] of lists) {
    const tech = TECHNIQUES.filter((t) => (TEMPLATES as Record<string, string[]>)[g]?.includes(t.name));
    for (const c of all) {
      if (seen.has(c)) fail(`library: ${c} listed twice`);
      seen.add(c);
    }
    const codes = kind === "old" && !full ? all.filter((_, i) => i % 50 === 0) : all;
    for (const code of codes) {
      const values = decodePuzzle(code);
      if (!uniqueSolution(values)) fail(`library ${g}: ${code} has no unique solution`);
      const log = logicalSolve(new Grid(values), tech);
      if (!log.solved) fail(`library ${g}: ${code} not solvable with the ${g} techniques`);
      const j = kind === "new" && !LIKES[code] ? judgeTemplate(values, g as (typeof DIFFICULTIES)[number]) : null;
      if (j && !j.fits) short++;
      checked++;
    }
  }
  if (short) fail(`library: ${short} new puzzles don't meet their recipe`);
  for (const code of Object.keys(LIKES)) decodePuzzle(code);
  console.log(
    `Library: ${checked} puzzles checked; new ${Object.entries(LIBRARY).map(([g, c]) => `${g} ${c.length}`).join(", ")}; old ${Object.entries(OLD_LIBRARY).map(([g, c]) => `${g} ${c.length}`).join(", ")}; ${Object.keys(LIKES).length} liked.`,
  );
}

// 8. Japanese Sums: every generated puzzle has exactly one solution (its own), every line
//    holds 1..n-2 once and two X's, the clues follow from the grid, and codes round-trip.
{
  if (runSums([0, 1, 2, 0, 3, 4, 5]).join() !== "3,12") fail("sums: runSums of X12X345 should be 3,12");
  if (runSums([1, 2, 3, 4, 5, 0, 0]).join() !== "15") fail("sums: runSums of 12345XX should be 15");
  let made = 0;
  let givens = 0;
  for (const [d, size] of Object.entries(SUMS_SIZES)) {
    for (let seed = 1; seed <= (size >= 8 ? 4 : 15); seed++) {
      const p = generateSums(size, seededRandom(seed * 101 + size));
      made++;
      givens += p.givens.filter(Boolean).length;
      for (let i = 0; i < size; i++) {
        const lines = [p.solution.slice(i * size, i * size + size), Array.from({ length: size }, (_, r) => p.solution[r * size + i])];
        for (const line of lines) {
          const digits = line.filter(Boolean);
          if (digits.length !== size - 2 || new Set(digits).size !== size - 2) fail(`sums ${d}: line ${line.join("")} is not 1..${size - 2} and two X's`);
        }
      }
      const clues = cluesOf(size, p.solution);
      if (JSON.stringify(clues.rowClues) !== JSON.stringify(p.rowClues) || JSON.stringify(clues.colClues) !== JSON.stringify(p.colClues)) fail(`sums ${d}: clues don't match the grid`);
      const r = solveSums(size, p.rowClues, p.colClues, p.solution.map((v, i) => (p.givens[i] ? v : -1)), 2);
      if (r.count !== 1 || r.solutions[0].join() !== p.solution.join()) fail(`sums ${d}: puzzle ${encodeSums(p)} doesn't have exactly its own solution (${r.count})`);
      const back = decodeSums(encodeSums(p));
      if (back.solution.join() !== p.solution.join() || back.givens.join() !== p.givens.join()) fail(`sums ${d}: code round trip failed for ${encodeSums(p)}`);
      if (!/^[A-Z]/.test(puzzleName(encodeSums(p), d, "sums"))) fail("sums: names start with a capital");
    }
  }
  let bad = false;
  try {
    decodeSums("J7-1-0");
  } catch {
    bad = true;
  }
  if (!bad) fail("sums: a code without a valid grid should be refused");
  console.log(`Japanese Sums: ${made} puzzles made and checked (${givens} given cells in total).`);
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll checks passed.");
