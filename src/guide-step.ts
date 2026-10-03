// Turns a stored example position into a grid and the step the technique finds there.
import { Grid, TECHNIQUES } from "./engine";
import type { Step } from "./engine";
import { EXAMPLES } from "./guide-examples";

export function exampleStep(name: string): { grid: Grid; step: Step } | null {
  const ex = EXAMPLES[name];
  if (!ex) return null;
  const values = [...ex.values].map(Number);
  const cands = Array.from({ length: 81 }, (_, i) => parseInt(ex.cands.slice(i * 3, i * 3 + 3), 8));
  const grid = new Grid(values, cands);
  const tech = TECHNIQUES.find((t) => t.name === ex.tech);
  const step = tech?.find(grid);
  return step ? { grid, step } : null;
}
