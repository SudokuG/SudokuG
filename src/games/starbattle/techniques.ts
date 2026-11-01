// The Techniques tab of Star Battle: what each step of the solver (logic.ts) means, roughly in
// the order you need them. The worked examples are in examples.ts (npm run lite-examples).
import type { LiteTechnique } from "../lite";

export const STAR_TECHNIQUES: LiteTechnique[] = [
  {
    name: "Around a Star",
    candidates: false,
    idea: "Every cell around a star (the eight cells beside and diagonally next to it) is empty.",
    why: "Stars never touch, not even at a corner.",
    spot: "Do it every time you place a star: dot its whole ring of neighbours straight away. It is the move that makes everything else visible.",
  },
  {
    name: "Full Unit",
    candidates: false,
    idea: "A row, column or region that has all its stars: every other cell in it is empty.",
    why: "Each row, column and region holds exactly as many stars as the puzzle says (one, or two on the big board), no more.",
    spot: "After each star, look along its row and column and around its region. Drag over the open cells and press the dot to empty them in one go.",
  },
  {
    name: "Last Cells",
    candidates: false,
    idea: "A row, column or region with exactly as many open cells left as stars it still needs: they are all stars.",
    why: "The stars have to go somewhere in the unit, and there is no other place left.",
    spot: "Small regions (one or two cells) at the start, and nearly dotted-out lines later on.",
  },
  {
    name: "Shared Neighbour",
    candidates: false,
    idea: "A unit has only a few places left for its (last) star. A cell outside that touches all of those places is empty, whichever place gets the star.",
    why: "Whichever of the places the star goes in, the cell would touch it, and stars never touch.",
    spot: "Regions squeezed into two or three cells side by side: the cells right above and below such a pair are empty. A region shaped like a little L or square empties the cells that hug its corner.",
  },
  {
    name: "Confined Unit",
    candidates: false,
    idea: "A region whose open cells all lie in one row: that row's star is in the region, so the rest of the row is empty. The same for a column, and the other way round: a row whose open cells all lie in one region empties the rest of that region.",
    why: "The row needs its stars and the region needs as many; when the region can only use that row, the two share the same stars, so nothing else in the row can have one. (With two stars per line, it works when they need the same number.)",
    spot: "Long thin regions, and regions that have been dotted down to one line. Also look at rows and columns that run through only one region's open cells.",
  },
  {
    name: "Squeeze",
    candidates: false,
    idea: "Imagine a star in a cell: it empties the eight cells around it. If that leaves some row, column or region without room for its stars, the cell is empty. (And if leaving a cell empty would leave a unit without room, it is a star.)",
    why: "A star there would break the puzzle at once, so it can't be one. On the two-star board this is the everyday move: a region that still needs two stars needs two cells that don't touch.",
    spot: "Cells next to small regions or nearly full lines. On the big board, any cell that touches most of a region's open cells, so that the rest would be one tight clump.",
  },
  {
    name: "Blocks",
    candidates: false,
    idea: "Two-star board: a unit still needs 2 stars and its open cells fit in two 2×2 blocks. A 2×2 block holds at most one star, so each block holds exactly one, and any cell that touches all the open cells of a block is empty.",
    why: "Two stars in one 2×2 block would touch. So the unit's two stars sit one in each block, and a star touching a whole block would leave that block empty.",
    spot: "Regions or lines dotted down to two small clumps.",
  },
  {
    name: "Pair Blocks",
    candidates: false,
    idea: "Two-star board: take two neighbouring rows (or columns) and cut them into 2×2 blocks. Each block holds at most one star. When only as many blocks have open cells as the two lines still need stars, each of those blocks holds exactly one, and cells touching all of a block's open cells are empty.",
    why: "Two rows need 4 stars (fewer once some are placed), and no 2×2 block can take two. If only that many blocks are still open, each must take one.",
    spot: "Pairs of rows where a few blocks have been dotted out completely. Try both cuts: blocks starting at the first column, or at the second.",
  },
  {
    name: "Region Groups",
    candidates: false,
    idea: "The counting move: some regions (2, 3 or 4) whose open cells all lie in as many rows. Those regions need as many stars as those rows, so all the rows' stars come from them, and every other cell in those rows is empty. The same with columns, and with rows that fit inside regions.",
    why: "Count stars. If 3 regions need 3 stars and can only put them in 3 rows that need 3 stars, then those rows have no stars to spare for any other cell.",
    spot: "Look at the edges of the board, where several small regions often sit in the same few rows or columns. Then look for regions stacked between two lines.",
  },
  {
    name: "Short Chain",
    candidates: false,
    idea: "Imagine a star (or an empty cell) somewhere and follow only the simplest moves (around a star, full units, last cells) for a few steps. If that already breaks something, the cell is the other way round.",
    why: "Everything after the assumption follows from the rules, so the problem can only come from the assumption.",
    spot: "Cells that would block a lot: a star near a small region, or next to a line that has little room left. Follow the chain in your head or with a pencil.",
  },
  {
    name: "Trial",
    candidates: false,
    idea: "A longer what-if: assume a star (or an empty cell), use all the moves above, and see whether it ends in a contradiction: two stars touching, too many stars in a unit, or a unit with no room left.",
    why: "As with the short chain: the contradiction can only come from the assumption. Expert puzzles need this up to three times; the hint shows the chain that breaks.",
    spot: "The cells of the tightest unit (the fewest open cells) first.",
  },
];
