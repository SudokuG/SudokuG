// The Techniques tab of Calcudoku: what each step of the solver (logic.ts) means. The worked
// examples are in examples.ts (made by `npm run lite-examples`).
import type { LiteTechnique } from "../lite";

export const CALC_TECHNIQUES: LiteTechnique[] = [
  {
    name: "Single",
    candidates: true,
    idea: "A cell where every digit but one is ruled out, by its row and column and by its cage.",
    spot: "Cells in nearly full lines, and cells of cages with few ways left.",
  },
  {
    name: "Hidden Single",
    candidates: true,
    idea: "A digit that has only one place left in a row or column.",
    spot: "Pick a digit missing from a line and check which cells can still take it, cage by cage.",
  },
  {
    name: "Cage Options",
    candidates: true,
    idea: "List every way to fill a cage: digits still possible in its cells, meeting the target, no digit twice in a row or column. A digit no way uses in a cell can go.",
    spot: "Start with telling cages: 3+ in two cells is 1 and 2; 5− on 6×6 is 1 and 6; a big product like 120× in three cells has few ways (4·5·6); 2÷ cages hold a digit and its double.",
  },
  {
    name: "Naked Pair",
    candidates: true,
    idea: "Two cells in a line that can only hold the same two digits between them: those digits leave the rest of the line.",
    spot: "Two-cell cages like 1− or 3+ often make a pair in their row or column.",
  },
  {
    name: "Hidden Pair",
    candidates: true,
    idea: "Two digits that can only go in the same two cells of a line: those cells hold just them.",
    spot: "Two digits that keep showing up in the same two places.",
  },
  {
    name: "Must-Have Digit",
    candidates: true,
    idea: "A digit that every way of a cage uses, always in the same row or column. Whatever the cage turns out to be, that line's copy of the digit is inside the cage, so it leaves the rest of the line.",
    spot: "Cages that lie along a line: if every way to make 7+ in three cells of a row (1+2+4) includes a 1, the rest of that row has no 1. Check which digit all options share.",
  },
  {
    name: "Naked Triple",
    candidates: true,
    idea: "Three cells in a line holding only three digits between them: those digits leave the rest of the line.",
    spot: "Three cells with candidates from the same three digits (not every cell needs all three).",
  },
  {
    name: "Hidden Triple",
    candidates: true,
    idea: "Three digits that can only go in the same three cells of a line: those cells hold just them.",
    spot: "Three digits that are confined to the same three cells.",
  },
  {
    name: "Trial",
    candidates: true,
    idea: "Assume a digit and follow the easier steps. If a cage or a line can no longer be filled, the digit is wrong. Expert puzzles need this up to three times.",
    spot: "A cell with two candidates where one of them would leave a cage without a way.",
  },
];
