// The Techniques tab of Calcudoku: what each step of the solver (logic.ts) means, roughly in
// the order you need them. The worked examples are in examples.ts (npm run lite-examples).
import type { LiteTechnique } from "../lite";

export const CALC_TECHNIQUES: LiteTechnique[] = [
  {
    name: "Single",
    candidates: true,
    idea: "A cell where every digit but one is ruled out, by its row and column and by its cage.",
    why: "Every row and column needs each digit once, and a cage's digits must reach its target, so digits that break either can't go in the cell.",
    spot: "Cells in nearly full lines, and cells of cages with few ways left.",
  },
  {
    name: "Hidden Single",
    candidates: true,
    idea: "A digit that has only one place left in a row or column.",
    why: "The line needs that digit somewhere; if the other cells are full or can't take it (their cage doesn't allow it), the one cell left must hold it.",
    spot: "Pick a digit missing from a line and check, cage by cage, which cells can still take it. Big digits often have few places: a 6 can't go in a 2÷ cage on a 6×6 unless the other cell is 3.",
  },
  {
    name: "Cage Options",
    candidates: true,
    idea: "List every way to fill a cage: digits still possible in its cells, meeting the target, no digit twice in a row or column. A digit no way uses in a cell can go.",
    why: "The cage must end up as one of those ways, so anything none of them uses is impossible.",
    spot: "Start with telling cages. Small and large sums in two cells: 3+ is 1+2, 11+ on a 6×6 is 5+6. Differences near n: 5− on a 6×6 is 1 and 6. Products with few factors: 120× in three cells is 4×5×6; a prime like 5 in a product means a 5 in the cage. 2÷ holds a digit and its double. Break products into primes to see which digits fit (the notes are for that).",
  },
  {
    name: "Naked Pair",
    candidates: true,
    idea: "Two cells in a line that can only hold the same two digits between them: those digits leave the rest of the line.",
    why: "Whichever way round they go, the two digits are used up by those cells.",
    spot: "Two-cell cages along a line, like 1− with candidates 3 and 4, or 7× (1 and 7), often make a pair for their row or column.",
  },
  {
    name: "Hidden Pair",
    candidates: true,
    idea: "Two digits that can only go in the same two cells of a line: those cells hold just them.",
    why: "The line needs both digits, and only those two cells can take them.",
    spot: "Two digits that keep showing up in the same two places.",
  },
  {
    name: "Must-Have Digit",
    candidates: true,
    idea: "A digit that every way of a cage uses, always in the same row or column. Whatever the cage turns out to be, that line's copy of the digit is inside the cage, so it leaves the rest of the line.",
    why: "The cage will hold the digit in that line in every case, and a line holds each digit only once.",
    spot: "Cages that lie along a line: if every way to make 7+ in three cells of a row (1+2+4 only) includes a 1, the rest of that row has no 1. Products with a prime factor work the same: 15× in a row always holds a 5 there.",
  },
  {
    name: "Naked Triple",
    candidates: true,
    idea: "Three cells in a line holding only three digits between them: those digits leave the rest of the line.",
    why: "The three cells need three different digits and only three are possible, so all three are used up there.",
    spot: "Three cells with candidates from the same three digits (not every cell needs all three).",
  },
  {
    name: "Hidden Triple",
    candidates: true,
    idea: "Three digits that can only go in the same three cells of a line: those cells hold just them.",
    why: "The line needs the three digits and only those three cells can take them.",
    spot: "Three digits that are confined to the same three cells.",
  },
  {
    name: "X-Wing",
    candidates: true,
    idea: "In two rows, a digit can only go in the same two columns. Then those two columns get their copy of the digit from these rows, so no other cell in them can hold it. (And with rows and columns swapped.)",
    why: "The four cells form a rectangle and the digit sits in two opposite corners, either way: both columns have it.",
    spot: "Pick a digit and look for rows where it has exactly two places left, in the same two columns.",
  },
  {
    name: "Trial",
    candidates: true,
    idea: "Assume a digit and follow the easier steps. If a cage can no longer be filled, a cell has nothing left or a digit has no place in a line, the digit is wrong.",
    why: "Everything after the assumption follows from the rules, so the contradiction comes from the assumption. Expert puzzles need this up to three times; the hint shows the chain that breaks.",
    spot: "A cell with two candidates where one of them leaves a neighbouring cage without a way.",
  },
];
