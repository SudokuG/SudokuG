# Roadmap

> Managed by Claude. To add or change anything, write it in NOTES.md.

## Goals
- ✓ v1.0 – Sudoku with human-style hints and rated puzzles without grind (sculpted, library, dailies)
- ✓ v1.0 – Lighter puzzle types on one shared page: Treasure Map, Futoshiki, Calcudoku, Star Battle
- Phone first: every type comfortable to play with one thumb
- All puzzle types look and work the same wherever that makes sense (P1)
- More puzzle types: a Str8ts-like type and Tectonic (Suguru) are on the maybe list
- More sudoku techniques (finned fish, W-Wing, Unique Rectangle, ALS)
- The whole site in English, German and Dutch (interface done in v1.7)

## Now
### v1.8 – Translate the rest: hints, Techniques tab, Rating card
- Hint texts (nudge and explanation) of sudoku and the light types, built from translatable
  pieces in the engines' step finders; the Techniques tab (idea, how to spot it, examples)
  and the sudoku Rating card; sample notes already done
- Before new techniques, so those get their texts in all languages from the start
- Verify: npm test (a row for every text), German and Dutch screenshots of a hint and each Techniques entry

## Next
- v1.9 – More sudoku techniques (until Q3 is answered): Finned X-Wing / Swordfish, W-Wing,
  then Unique Rectangle; each with hint texts in all languages, a guide entry with a worked
  example, its place in TECHNIQUES and the rating groups

## Later
- A Str8ts-like puzzle type under its own name (Str8ts is a trademark)
- Tectonic / Suguru as a light type (own name, e.g. themed like the others)
- More sudoku techniques after v1.9: ALS, forcing chains

## Done
- ✓ v1.7 – Language option: interface in English, German, Dutch; no browser auto-translate
- ✓ v1.6 – Play fixes: candidates come back, Futoshiki gap taps, pad highlight, no lingering focus
- ✓ v1.5 – General refactoring round (shared pad code, styles and solvers split)

Older: see CHANGELOG.md
