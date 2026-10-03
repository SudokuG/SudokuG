// Texts for the Techniques section. Each entry explains the idea in general and how to
// spot it; the example board below it is a real position (see guide-examples.ts) and its
// specific explanation comes from the engine itself.

export interface GuideEntry {
  name: string;
  /** Difficulty group shown as a heading in the list. */
  group: "Easy" | "Medium" | "Hard" | "Expert" | "Extreme";
  /** Shown as a small tag: grindy techniques and ones that can be. */
  tag?: string;
  idea: string;
  spot: string;
}

export const GUIDE: GuideEntry[] = [
  {
    name: "Full House",
    group: "Easy",
    idea: "A row, column or box has only one empty cell left. It must hold the one digit that unit is still missing.",
    spot: "Look for units with eight digits filled in.",
  },
  {
    name: "Hidden Single",
    group: "Easy",
    idea: "Within a row, column or box, a digit fits in only one cell, because every other cell is filled or already sees that digit.",
    spot: "Pick a digit and a box, then cross out every cell that sees that digit. If one cell is left, that's it. Scanning digit by digit is the fastest way through a grid.",
  },
  {
    name: "Naked Single",
    group: "Easy",
    idea: "A cell has only one candidate left: its row, column and box together already contain the other eight digits.",
    spot: "Look at crowded areas where a cell's row, column and box are nearly full, or at cells with a single pencil mark.",
  },
  {
    name: "Locked Candidates (Pointing)",
    group: "Medium",
    idea: "Inside a box, a digit can only go in cells that all lie on one row (or column). Whichever cell it ends up in, that row's copy of the digit sits in this box, so the digit can be removed from the rest of the row.",
    spot: "While scanning a box for a digit, notice when its possible cells line up. Then follow that line out of the box.",
  },
  {
    name: "Locked Candidates (Claiming)",
    group: "Medium",
    idea: "The reverse of pointing: in a row (or column), a digit can only go in cells inside one box. The box's copy of that digit must then be on this row, so it can be removed from the box's other cells.",
    spot: "Scan a row or column for a digit; if all its spots fall inside one box, clear the rest of that box.",
  },
  {
    name: "Naked Pair",
    group: "Medium",
    idea: "Two cells in a unit have the same two candidates and nothing else. Those two digits must go in those two cells, so they can be removed from every other cell in the unit.",
    spot: "Look for two cells with identical two-candidate notes that share a row, column or box.",
  },
  {
    name: "Hidden Pair",
    group: "Medium",
    idea: "In a unit, two digits can each only go in the same two cells. Those cells must hold those two digits, so any other candidates in them can go.",
    spot: "When scanning a unit digit by digit, notice two digits that are restricted to the same two cells.",
  },
  {
    name: "Naked Triple",
    group: "Hard",
    tag: "grindy",
    idea: "Three cells in a unit together contain only three different candidates (each cell may have two or three of them). Those three digits fill those three cells and can be removed elsewhere in the unit.",
    spot: "Hard to see without full notes. Easy when a unit has only a few empty cells; tedious in a wide-open row. The rating counts it as grind when it's the only way forward.",
  },
  {
    name: "Hidden Triple",
    group: "Hard",
    tag: "grindy",
    idea: "Three digits in a unit can only go in the same three cells. Those cells hold exactly those digits, so their other candidates can be removed.",
    spot: "The mirror image of a naked subset: in a unit with k empty cells, a hidden triple is the same move as a naked subset of size k − 3.",
  },
  {
    name: "X-Wing",
    group: "Hard",
    idea: "In two rows, a digit can only go in the same two columns. Each row needs that digit once, and they can't share a column, so the two copies take both columns. The digit can be removed from the rest of those two columns. (The same works with rows and columns swapped.)",
    spot: "Look for a rectangle: one digit with exactly two spots in each of two rows, lined up in the same columns.",
  },
  {
    name: "Skyscraper",
    group: "Hard",
    idea: "One digit has exactly two spots in each of two rows (or columns). One end of each lines up; the other ends don't. One of the two unaligned ends must hold the digit, so any cell that sees both of them can't.",
    spot: "An X-Wing with one corner off by a bit, so it looks like two towers of different height.",
  },
  {
    name: "2-String Kite",
    group: "Hard",
    idea: "One digit has exactly two spots in a row and exactly two spots in a column, and one end of each lies in the same box. Following the chain, one of the two far ends must be the digit, so a cell that sees both far ends can't be.",
    spot: "Find a box where a row-pair and a column-pair of the same digit meet; the elimination is at the crossing of the two far ends.",
  },
  {
    name: "Turbot Fish",
    group: "Hard",
    idea: "The general form of the Skyscraper and the 2-String Kite: two places where a digit has only two spots, connected because one end of each sees the other. One of the two outer ends must be the digit.",
    spot: "Follow a digit from a two-spot unit to another two-spot unit through a box.",
  },
  {
    name: "XY-Wing",
    group: "Expert",
    idea: "A pivot cell with candidates XY sees two cells with XZ and YZ. If the pivot is X, the XZ cell becomes Z; if it's Y, the YZ cell becomes Z. Either way one of the wings is Z, so Z can be removed from any cell that sees both wings.",
    spot: "Look for three two-candidate cells whose digits form a triangle: AB, AC and BC, with the AB cell seeing the other two.",
  },
  {
    name: "Simple Coloring",
    group: "Expert",
    idea: "Pick a digit and follow every unit where it has only two spots. Color those cells alternately blue and pink: one color holds all the true copies. A cell that sees both colors can't be the digit. If two cells of one color see each other, that color is false.",
    spot: "Choose a digit with many two-spot units and start coloring. Works best with full notes for that one digit.",
  },
  {
    name: "XYZ-Wing",
    group: "Expert",
    idea: "Like an XY-Wing, but the pivot has three candidates XYZ and the wings are XZ and YZ. One of the three cells must be Z, so Z can be removed from cells that see all three.",
    spot: "Look for a three-candidate cell with two two-candidate cells around it that share one digit with each other.",
  },
  {
    name: "Swordfish",
    group: "Expert",
    idea: "An X-Wing with three rows: in three rows a digit has two or three spots, all within the same three columns. The three copies take those three columns, so the digit can be removed from the rest of those columns.",
    spot: "Follow one digit across the grid and look for three rows whose spots stay inside three columns.",
  },
  {
    name: "Naked Quad",
    group: "Extreme",
    tag: "grindy",
    idea: "Four cells in a unit together contain only four candidates. Those four digits fill those cells and can be removed from the rest of the unit.",
    spot: "Only findable with full notes and a careful search of a wide-open unit. The engine reports quads only in units with eight or more empty cells; with fewer, a smaller subset does the same job.",
  },
  {
    name: "Hidden Quad",
    group: "Extreme",
    tag: "grindy",
    idea: "Four digits in a unit can only go in the same four cells, so those cells hold exactly those digits and their other candidates can go.",
    spot: "Very rare in practice and very tedious to find.",
  },
  {
    name: "X-Chain",
    group: "Extreme",
    idea: "A chain on one digit. Strong links (=, a unit where the digit has only two spots) and weak links (−, two cells that see each other) alternate. If the first cell isn't the digit, the next one is, so the next isn't... and the last one is. So one of the two ends holds the digit, and a cell seeing both ends can't.",
    spot: "A longer Skyscraper or Kite. Follow one digit from two-spot unit to two-spot unit.",
  },
  {
    name: "Two-Digit Chain",
    group: "Extreme",
    idea: "A chain that only uses two digits. Links can go through a cell (if it's not A, it's B in a two-candidate cell) or along a unit. The ends work as with any chain: at least one end is true.",
    spot: "Often follows a pair of digits that keeps showing up together in several cells.",
  },
  {
    name: "Jellyfish",
    group: "Extreme",
    idea: "The four-row version of the X-Wing and Swordfish: in four rows a digit is limited to the same four columns, so it can be removed from the rest of those columns.",
    spot: "Rare. Needs one digit spread thinly across four rows.",
  },
  {
    name: "XY-Chain",
    group: "Extreme",
    tag: "often grindy",
    idea: "A chain through cells with exactly two candidates. Entering a cell with one digit forces the other; the next cell must share that digit. One of the two ends holds the digit they have in common.",
    spot: "Counts as grind when it uses three or more different digits: following it is close to solving the puzzle in your head.",
  },
  {
    name: "Alternating Inference Chain",
    group: "Extreme",
    tag: "often grindy",
    idea: "The general chain: any mix of strong links (at least one is true) and weak links (at least one is false), across cells and units. All other chains are special cases.",
    spot: "Counts as grind when it uses three or more different digits.",
  },
];
