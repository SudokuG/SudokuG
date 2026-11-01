// The Techniques tab of Treasure Map: what each step of the solver (logic.ts) means. The
// worked examples are in examples.ts (made by `npm run lite-examples`).
import type { LiteTechnique } from "../lite";

export const SUMS_TECHNIQUES: LiteTechnique[] = [
  {
    name: "Single",
    candidates: false,
    idea: "A cell where everything but one possibility is ruled out. A cell that can't be an X and sees all digits but one in its row and column holds that digit; a cell that can't hold any digit still missing from its row and column is an X.",
    why: "A cell that can't be an X and sees every digit but one in its row and column must hold that digit.",
    spot: "Look at cells with a ring (they hold a digit) in rows and columns that are nearly full.",
  },
  {
    name: "Hidden Single",
    candidates: false,
    idea: "A digit that has only one place left in a row or column: the other cells are filled, are X's, or see that digit in their column or row.",
    why: "The row needs that digit somewhere, and the other cells are either full, X's, or see the digit already.",
    spot: "Pick a digit that is missing from a line and check where it could still go.",
  },
  {
    name: "Last X's",
    candidates: false,
    idea: "Every line has exactly two X's. When a line has just as many places left for an X as it still needs, those places are X's.",
    why: "Every line holds exactly two X's, so when only that many places are left for them, they must be the X's.",
    spot: "Lines with many digits and rings: the few cells left over are the X's.",
  },
  {
    name: "Clue X's",
    candidates: false,
    idea: "List the ways a clue can be built: where its two X's go and which digits form each group. Whatever holds in every way is true: a cell that is an X in every way is an X; a cell that is never an X holds a digit (give it a ring); a group that can only be one digit fixes that cell.",
    why: "The line will end up as one of those ways, so what all of them agree on is certain. Working out only where the X's go (with rings for “a digit here”) is usually enough: most maps can be solved without writing candidates.",
    spot: "Start with telling clues. 15 (on a 7×7 map) means no X between the digits: the X's are at both ends, or side by side at one end. A small sum like 1 or 2 is a single digit with an X on each side. A big sum like 14 needs four digits. Three numbers mean both X's are inside the line, so the end cells hold digits.",
  },
  {
    name: "Candidate Single",
    candidates: true,
    idea: "The same as a single, but only visible once you write candidates: a cell with one candidate left, or a digit with one candidate place left in a line.",
    why: "The same as a single; the candidates only make it visible.",
    spot: "Write candidates in a line where the clue leaves few options, then look for a lone one.",
  },
  {
    name: "Clue Groups",
    candidates: true,
    idea: "The clue reasoning again, now with the candidates: each group must add up using digits that are still candidates in its cells, and the digits of the groups must all differ. Ways that need a digit a cell can't hold drop out, and with them candidates and X's.",
    why: "Each group must be made of digits that its cells can still take; a way that needs a digit a cell can't hold is impossible, and with it whatever only that way allowed.",
    spot: "Lines where most cells have two or three candidates: try which digits each group can take.",
  },
  {
    name: "Line Arrangements",
    candidates: true,
    idea: "The same, also trying the order of the digits within each group. Rarely needed, but it can settle a line where every split of the digits fits.",
    why: "Like Clue Groups, but the order inside each group must also fit the candidates, which can rule out a few more ways.",
    spot: "A line whose groups have two digits each, with candidates that allow only some orders.",
  },
  {
    name: "Trial",
    candidates: true,
    idea: "Assume a value in a cell and follow the easier steps. If that leads to a line that can't add up, the value is wrong. Generated maps never need it, but a hint may use it on a map with mistakes fixed late, or on a loaded one.",
    why: "Everything after the assumption follows from the rules, so the contradiction comes from the assumption. The hint shows the chain: what the assumption forces, step by step, and where it breaks.",
    spot: "A cell with two possibilities, where one of them would leave a clue without a way.",
  },
];
