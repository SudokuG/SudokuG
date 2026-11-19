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
### v1.2 – Consistency between the puzzle types
- The alignments agreed in Q1 (outline option, Redo, button rows, candidates, digits
  left, region default, Star Battle cursor, candidate shading in sudoku)
- Sweep on the sudoku pad, if wanted (Q2)
- Verify: phone and desktop screenshots of every type side by side
- Waiting for: Q1, Q2

## Next
### v1.3 – Split app.ts and lite.ts
- Both are past ~1700 lines: input, render and options as their own modules; no behaviour change
- Verify: typecheck, tests, the same screenshots as before

## Later
- A Str8ts-like puzzle type under its own name (Str8ts is a trademark)
- Tectonic / Suguru as a light type (own name, e.g. themed like the others)
- More sudoku techniques: finned fish, W-Wing, Unique Rectangle, ALS, forcing chains

## Done
- ✓ v1.1 – Input and selection on every type
- ✓ v1.0 – Sudoku, generator, library, dailies and four light puzzle types

Older: see CHANGELOG.md
