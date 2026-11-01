// The Techniques tab of Futoshiki: what each step of the solver (logic.ts) means. The worked
// examples are in examples.ts (made by `npm run lite-examples`).
import type { LiteTechnique } from "../lite";

export const FUTO_TECHNIQUES: LiteTechnique[] = [
  {
    name: "Single",
    candidates: true,
    idea: "A cell where every digit but one is ruled out, by its row and column and by the signs around it.",
    spot: "Cells in nearly full lines, and cells at the end of a chain of signs.",
  },
  {
    name: "Hidden Single",
    candidates: true,
    idea: "A digit that has only one place left in a row or column.",
    spot: "Where can the 1 go in this row? The 1 can't be on the large side of a sign, and the largest digit can't be on the small side.",
  },
  {
    name: "Sign",
    candidates: true,
    idea: "A sign narrows both its cells: the smaller cell stays below the largest digit still possible on the other side, and the larger cell above the smallest one. Chains add up: in a < b < c, a is at most n−2 and c at least 3.",
    spot: "Follow chains of signs pointing the same way, and signs next to cells that are already narrowed.",
  },
  {
    name: "Naked Pair",
    candidates: true,
    idea: "Two cells in a line that can only hold the same two digits between them: those digits go there, so they leave the rest of the line.",
    spot: "Two cells with the same two candidates, often pushed there by signs.",
  },
  {
    name: "Hidden Pair",
    candidates: true,
    idea: "Two digits that can only go in the same two cells of a line: those cells hold just them, so their other candidates go.",
    spot: "Two digits that keep showing up in the same two places.",
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
    idea: "Assume a digit and follow the easier steps. If that runs into a contradiction (a cell with nothing left, or a sign that can't hold), the digit is wrong. Expert puzzles need this up to three times.",
    spot: "A cell with two candidates where one of them would push a chain of signs past its limit.",
  },
];
