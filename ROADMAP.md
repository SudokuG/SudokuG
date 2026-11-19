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
### v1.6 – More sudoku techniques (until Q3 is answered)
- Finned X-Wing / Swordfish, W-Wing, then Unique Rectangle; each with hint texts, a guide
  entry with a worked example, its place in TECHNIQUES and the rating groups
- Verify: npm test (every step checked against the brute-force solution), fewer stuck puzzles in the summary

## Next
- (empty: write new wishes in NOTES.md; Q3 decides between techniques and a new type)

## Later
- A Str8ts-like puzzle type under its own name (Str8ts is a trademark)
- Tectonic / Suguru as a light type (own name, e.g. themed like the others)
- More sudoku techniques after v1.6: ALS, forcing chains

## Done
- ✓ v1.5 – General refactoring round (shared pad code, styles and solvers split)
- ✓ v1.4 – Candidate entry green in every type; option Sweep in digit mode
- ✓ v1.3 – Split app.ts and lite.ts into parts (no change in play)

Older: see CHANGELOG.md
