# Roadmap

> Managed by Claude. To add or change anything, write it in NOTES.md.

## Goals
- ✓ v1.0 – Sudoku with human-style hints and rated puzzles without grind (sculpted, library, dailies)
- ✓ v1.0 – Lighter puzzle types on one shared page: Treasure Map, Futoshiki, Calcudoku, Star Battle
- Phone first: every type comfortable to play with one thumb
- All puzzle types look and work the same wherever that makes sense (P1)
- More puzzle types: a Str8ts-like type and Tectonic (Suguru) are on the maybe list
- More sudoku techniques (finned fish, W-Wing, Unique Rectangle, ALS)

## Now
### v1.1 – Input and selection on every type
- Pad: two rows on a phone for the light types; keys act on the first touch; no text
  selection or search pop-up when holding a key
- Sweep over the light pad keys to toggle candidates (one undo step)
- Tap outside the grid: nothing selected (all types)
- A pad key with nothing selected highlights that digit and its candidates (all types)
- Selection outline around each group of selected cells, every selected cell outlined
  (light types except Futoshiki, which keeps a frame per cell)
- Separate options: row/column and box (sudoku) or region (Star Battle, Calcudoku)
- Star Battle and Calcudoku region lines drawn as SVG (clean corners)
- Treasure Map: clue column only as wide as its clues
- Verify: phone and desktop screenshots of each type; typecheck, tests, build

## Next
### v1.2 – Consistency between the puzzle types
- The alignments agreed in Q1 (pad layout, button rows, options, colours)
- Sweep on the sudoku pad, if wanted (Q2)

## Later
- Split app.ts and lite.ts (both past ~1700 lines): input, render and options as modules
- A Str8ts-like puzzle type under its own name (Str8ts is a trademark)
- Tectonic / Suguru as a light type (own name, e.g. themed like the others)
- More sudoku techniques: finned fish, W-Wing, Unique Rectangle, ALS, forcing chains

## Done
- ✓ v1.0 – Sudoku, generator, library, dailies and four light puzzle types

Older: see CHANGELOG.md
