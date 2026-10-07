// Shared by the scripts that make puzzles ahead of time (dailies and the library).
import { fork } from "node:child_process";
import { writeFileSync } from "node:fs";
import { REQUIREMENTS, TEMPLATES, encodePuzzle, generateRatedSync } from "../src/engine";
import type { Group } from "../src/engine";

/**
 * A puzzle of a template that has all the moves REQUIREMENTS asks for, searched without
 * a time limit (up to 3 rounds of 20 candidates; the best one if none gets there).
 */
export function goodPuzzle(g: Group, rnd: () => number): { code: string; missing: number } {
  const allowed = TEMPLATES[g];
  if (!REQUIREMENTS[g]) return { code: encodePuzzle(generateRatedSync({ allowed }, rnd).puzzle), missing: 0 };
  let best: { code: string; missing: number } | null = null;
  for (let round = 0; round < 3; round++) {
    const r = generateRatedSync({ allowed, maxCandidates: 20, triesPerCandidate: 3000 }, rnd);
    if (!best || r.missing < best.missing) best = { code: encodePuzzle(r.puzzle), missing: r.missing };
    if (!best.missing) break;
  }
  return best!;
}

/**
 * Run make(i) for i = 0..n-1 on several processes. In the parent it returns the results;
 * in a worker process (started by this function) it does its share and exits.
 */
export function parallel<T>(n: number, make: (i: number) => T, workers: number, label = "done"): Promise<T[]> {
  const part = process.env.POOL_PART;
  if (part) {
    const [k, w] = part.split("/").map(Number);
    for (let i = k; i < n; i += w) process.send!({ i, value: make(i) });
    process.exit(0);
  }
  const out = new Array<T>(n);
  const t0 = Date.now();
  let done = 0;
  return Promise.all(
    Array.from(
      { length: Math.min(workers, n) },
      (_, k) =>
        new Promise<void>((resolve, reject) => {
          const child = fork(process.argv[1], process.argv.slice(2), { env: { ...process.env, POOL_PART: `${k}/${Math.min(workers, n)}` } });
          child.on("message", (m: { i: number; value: T }) => {
            out[m.i] = m.value;
            if (++done % 20 === 0 || done === n) console.log(`${done}/${n} ${label} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
          });
          child.on("exit", (code) => (code ? reject(new Error(`worker ${k} failed`)) : resolve()));
        }),
    ),
  ).then(() => out);
}

/** Write src/library-data.ts. */
export function writeLibrary(library: Record<string, string[]>, likes: Record<string, string[]>): void {
  const lists = Object.entries(library)
    .map(([g, codes]) => `  ${g}: [\n${codes.map((c) => `    "${c}",`).join("\n")}\n  ],`)
    .join("\n");
  const liked = Object.entries(likes)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([c, ids]) => `  ${c}: [${ids.map((id) => JSON.stringify(id)).join(", ")}],`)
    .join("\n");
  writeFileSync(
    "src/library-data.ts",
    `// Puzzle library, written by scripts/make-library.ts and scripts/add-likes.ts. Do not edit by hand.
// LIBRARY: puzzle codes per difficulty. LIKES: puzzle code -> ids of the browsers that liked it.
export const LIBRARY: Record<string, string[]> = {
${lists}
};
export const LIKES: Record<string, string[]> = {
${liked}
};
`,
  );
}
