// Built-in sample puzzles. "." means an empty cell.
// Each "note" is the hardest technique the logical solver needs (checked by the tests).
export interface Sample {
  name: string;
  note: string;
  puzzle: string;
}

export const SAMPLES: Sample[] = [
  {
    name: "Easy",
    note: "Singles only",
    puzzle: "..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..",
  },
  {
    name: "Medium",
    note: "Needs locked candidates",
    puzzle: "7...1.4...5.7.32...9..4.18......2..8.........3..4......26.7..5...41.8.6...5.2...3",
  },
  {
    name: "Pairs",
    note: "Needs a naked pair",
    puzzle: "4.5.3..8..9.7..3......95..41.....24.2.......5.59.....13..58......2..7.3..4..2.7.8",
  },
  {
    name: "Hidden",
    note: "Needs a hidden pair",
    puzzle: "8.1..2.7.2..1......4.9......63...9...2..5..1...4...73......5.9......3..4.9.7..2.5",
  },
  {
    name: "Triple",
    note: "Uses a naked triple, but a pattern also works",
    puzzle: "..71....6......4...8.2...37.4.8..329.........293..7.8.61...3.9...8......4....17..",
  },
  {
    name: "X-Wing",
    note: "Needs an X-Wing",
    puzzle: "8.7.........4..87..64..1.9..2...7.5.1..2.9..8.7.8...6..8.9..51..51..2.........9.6",
  },
  {
    name: "Skyscraper",
    note: "Needs a Skyscraper",
    puzzle: "65..4..8...1..6..4.9..17...42.........6...8.........39...67..5.8..1..9...3..8..71",
  },
  {
    name: "Kite",
    note: "Needs a 2-String Kite",
    puzzle: ".7....3..1...4.95....9..1.642...6..7....9....6..1...948.2..4....46.7...1..7....2.",
  },
  {
    name: "XY-Wing",
    note: "Needs an XY-Wing",
    puzzle: ".32..5..4.......2.4..21...6.76.32.....3.9.5.....54.63.9...27..5.6.......3..9..74.",
  },
  {
    name: "Coloring",
    note: "Needs Simple Coloring",
    puzzle: ".....8.3...127...4.2..6.....3.9..2.12...3...99.4..7.8.....8..4.6...519...8.6.....",
  },
  {
    name: "Swordfish",
    note: "Needs a Swordfish",
    puzzle: "4......9....89.45...1..43....32....7.1.....6.7....91....93..7...42.17....5......4",
  },
  {
    name: "Two-Digit",
    note: "Needs a chain that uses only two digits",
    puzzle: "..1.9...7.7...1...2....718..1...6.....5...3.....3...9..275....6...8...4.3...1.2..",
  },
  {
    name: "XY-Chain",
    note: "Needs long XY-Chains with three or more digits (grindy)",
    puzzle: "4......6..7213.........2..4754.2.9.............8.9.4128..3.........4582..4......1",
  },
  {
    name: "Chain",
    note: "Needs long mixed chains with three or more digits (grindy)",
    puzzle: "..539...8.3.....2......53.632..6.9..95.....73..8.3..644.37......8.....4.5...246..",
  },
  {
    name: "Grindy",
    note: "A naked triple is the only way forward once",
    puzzle: ".37...24..1...4.6.5..7.6...84....7.5.........2.9....84...1.5..6.6.4...3..81...45.",
  },
  {
    name: "Quad",
    note: "Needs a naked quad",
    puzzle: "...6....4..147.2.....9.5....5.....8714.....6236.....4....8.2.....5.418..9....6...",
  },
  {
    name: "Tough",
    note: "Beyond the current techniques",
    puzzle: "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..",
  },
];
