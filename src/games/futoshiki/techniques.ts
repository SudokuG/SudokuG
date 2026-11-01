// The Techniques tab of Futoshiki: what each step of the solver (logic.ts) means, roughly in
// the order you need them. The worked examples are in examples.ts (npm run lite-examples).
import type { LiteTechnique } from "../lite";

export const FUTO_TECHNIQUES: LiteTechnique[] = [
  {
    name: "Single",
    candidates: true,
    idea: "A cell where every digit but one is ruled out: by the digits already in its row and column, and by the signs around it.",
    why: "Every row and column needs each digit once, so a digit that is already in the row or column can't go in this cell. A sign takes away digits too: the smaller side of a sign can never be the biggest digit, the larger side never 1.",
    spot: "Cells in nearly full rows and columns, and cells squeezed between signs (bigger than one neighbour, smaller than another).",
  },
  {
    name: "Hidden Single",
    candidates: true,
    idea: "A digit that has only one place left in a row or column.",
    why: "The row needs that digit somewhere. If every other cell is full, already sees the digit in its column, or can't take it because of a sign, the one cell left must hold it.",
    spot: "Good digits to ask about are the extremes. Where can the 1 go in this row? Not on the larger side of any sign. Where can the biggest digit go? Not on the smaller side of any sign.",
  },
  {
    name: "Sign Chain",
    candidates: true,
    idea: "Signs that point the same way form a chain, a < b < c < d. Each cell in it is held in by its place: the first is at most n−3 (three bigger digits must fit above it), the last at least 4, and the ones in between in a range.",
    why: "The digits along the chain all differ and keep rising, so a chain of k cells needs k different digits in order. Counting the cells above and below a cell in the chain gives its range at once.",
    spot: "Look for long arrows of signs, often bending around a corner from a row into a column. Long chains at the start of a puzzle settle a lot.",
  },
  {
    name: "Sign",
    candidates: true,
    idea: "A single sign narrows both its cells: the smaller cell stays below the biggest digit the other one can still be, and the larger cell above the smallest.",
    why: "If the larger cell can be at most 4, the smaller one can be at most 3. Every time a cell is narrowed, its signs pass that on, so the effect can travel across the board.",
    spot: "Signs next to cells that just got narrowed or filled, especially a sign next to a placed digit: 2 < x means x is at least 3.",
  },
  {
    name: "Naked Pair",
    candidates: true,
    idea: "Two cells in a line that can only hold the same two digits between them: those two digits go there, so they leave the rest of the line.",
    why: "Whichever way round the two cells are filled, both digits are used up by them. No other cell in the row (or column) can hold either.",
    spot: "Two cells with the same two candidates, often pushed there by signs: two neighbours both smaller than a 3 hold 1 and 2.",
  },
  {
    name: "Hidden Pair",
    candidates: true,
    idea: "Two digits that can only go in the same two cells of a line: those cells hold just them, so their other candidates go.",
    why: "The line needs both digits, and only those two cells can take them, so the two cells are used up by them.",
    spot: "Two digits that keep showing up in the same two places, for example the two biggest digits in a row where most cells are the smaller side of a sign.",
  },
  {
    name: "Naked Triple",
    candidates: true,
    idea: "Three cells in a line holding only three digits between them: those digits leave the rest of the line.",
    why: "The same as a pair, with three: the three cells need three different digits, and only three are possible, so all three are used up there.",
    spot: "Three cells with candidates from the same three digits (not every cell needs all three, e.g. 12, 23 and 13).",
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
    idea: "In two rows, a digit can only go in the same two columns. Then those two columns get their copy of the digit from these rows, so no other cell in the two columns can hold it. (And the same with rows and columns swapped.)",
    why: "The four cells form a rectangle. The digit sits in two opposite corners, one way or the other, and in both cases each of the two columns already has it.",
    spot: "Pick a digit and look at the rows where it has exactly two places left. Two such rows with the same two columns make an X-Wing.",
  },
  {
    name: "Trial",
    candidates: true,
    idea: "Assume a digit in a cell and follow what it forces with the easier steps. If that leads to something impossible, such as a cell with nothing left, a digit with no place in a line, or a sign that can no longer hold, the digit is wrong.",
    why: "Every step after the assumption follows from the rules, so the contradiction can only come from the assumption. Expert puzzles need this up to three times; the hint shows the chain that breaks.",
    spot: "A cell with two candidates where one of them would push a chain of signs past its limit. Try the choice that seems to squeeze the signs the most.",
  },
];
