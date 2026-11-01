// Finds a worked example for every technique of the lighter puzzle types (the Techniques
// tab): a puzzle code and the step on its solve that uses the technique. Small boards first,
// and a step that comes after a few others, so the board isn't empty.
// Writes src/games/<type>/examples.ts. Run: npm run lite-examples (after changing a solver).

import { writeFileSync } from "node:fs";
import { seededRandom } from "../src/engine";
import type { LiteGame, LitePuzzle } from "../src/games/lite";
import type { LiteStep } from "../src/games/logic";
import { FUTOSHIKI } from "../src/games/futoshiki/game";
import { TREASURE_MAP } from "../src/games/sums/game";
import { cluesOf, randomGrid, solveSums } from "../src/games/sums/engine";

/** All steps of a solve, the way the page replays them. */
function solveSteps<P extends LitePuzzle>(g: LiteGame<P>, p: P): LiteStep[] {
  const sol = g.solver(p);
  const s = sol.start();
  const out: LiteStep[] = [];
  for (let k = 0; k < 600 && !s.placed.every(Boolean); k++) {
    const st = sol.next(s);
    if (!st) break;
    out.push(st);
    sol.apply(s, st);
  }
  return out;
}

const run = (it: Generator<number, unknown>) => {
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
};

function find<P extends LitePuzzle>(g: LiteGame<P>, extra: (seed: number) => P | null): Record<string, { code: string; step: number }> {
  const out: Record<string, { code: string; step: number }> = {};
  const want = g.techniques.map((t) => t.name);
  const consider = (p: P) => {
    const steps = solveSteps(g, p);
    steps.forEach((st, k) => {
      if (out[st.technique] || !want.includes(st.technique)) return;
      // Not right at the start (an emptier board shows less), unless the solve is short.
      if (k < Math.min(6, steps.length / 4) && st.level <= 1) return;
      out[st.technique] = { code: g.encode(p), step: k };
    });
  };
  for (const size of g.sizes)
    for (const level of [...g.levels].reverse())
      for (let seed = 1; seed <= 40 && want.some((t) => !out[t]); seed++) consider(run(g.make(size, level, seededRandom(seed * 7919 + size * 31 + level.length))) as P);
  for (let seed = 1; seed <= 4000 && want.some((t) => !out[t]); seed++) {
    const p = extra(seed);
    if (p) consider(p);
  }
  const missing = want.filter((t) => !out[t]);
  if (missing.length) console.warn(`${g.title}: no example found for ${missing.join(", ")}`);
  return out;
}

function write(path: string, name: string, title: string, ex: Record<string, { code: string; step: number }>): void {
  const body = Object.entries(ex)
    .map(([t, e]) => `  ${JSON.stringify(t)}: { code: ${JSON.stringify(e.code)}, step: ${e.step} },`)
    .join("\n");
  writeFileSync(path, `// Worked examples for the ${title} techniques: a puzzle code and the step (0-based) of its\n// solve that uses the technique. Made by scripts/make-lite-examples.ts; do not edit by hand.\nexport const ${name}: Record<string, { code: string; step: number }> = {\n${body}\n};\n`);
  console.log(`${title}: ${Object.keys(ex).length} examples written to ${path}`);
}

// Treasure Map: generated maps never need trial; random clue-only grids sometimes do.
write(
  "src/games/sums/examples.ts",
  "SUMS_EXAMPLES",
  "Treasure Map",
  find(TREASURE_MAP, (seed) => {
    const n = 6 + (seed % 2);
    const solution = randomGrid(n, seededRandom(seed * 104729));
    const p = { n, solution, givens: new Array(n * n).fill(false), ...cluesOf(n, solution) };
    return solveSums(n, p.rowClues, p.colClues, new Array(n * n).fill(-1), 2).count === 1 ? p : null;
  }),
);
write("src/games/futoshiki/examples.ts", "FUTO_EXAMPLES", "Futoshiki", find(FUTOSHIKI, () => null));
