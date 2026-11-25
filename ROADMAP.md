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
- v1.9 – Security hardening (from the security audit of 2026-11-25; no confirmed
  vulnerabilities, these close two open leads and tighten defaults):
  - Links: `decodeURIComponent(location.hash)` inside the try (app.ts:314, lite.ts:220),
    so `#%` no longer aborts start-up and clears the continue pointer; cap code length
    before base-62 decoding (engine/code.ts, games/latin.ts; reject leftover in unpackB62)
  - Solvers: node budget in countSolutions (engine/solver.ts) plus hidden singles, budget
    treated as "not checked"; Calcudoku: decoder limited to CALC_SIZES, bounded connected
    +/× cages, node budget in cageWays (also fixes eliminations when the 5000 cap
    truncates); restore accepts a stored "Unrated" level (lite/puzzles.ts:91);
    decodeStars/decodeFutoshiki limited to the generated sizes
  - Rendering: `esc()` also escapes `"` and `>` (lite/markup.ts, sudoku/generate.ts);
    stored stats numbers through `Number()` before innerHTML (sudoku/finish.ts,
    lite/puzzles.ts)
  - Storage: saved daily.difficulty checked against DIFFICULTIES; stats maps and i18n
    dictionaries without prototype (`Object.create(null)`/`Object.hasOwn`); per-field
    type checks for settings, print and lite options against their defaults
  - Service worker: delete only `sudokug-` caches, match in its own cache, cache only ok
    responses (src/sw.js)
  - CI: actions pinned to commit SHAs (deploy.yml); refresh the lockfile's stale root
    version
  - Local tools: grow.ts server checks Host/Origin; add-likes accepts only app-style ids
    and readLibrary decodes ids with JSON.parse (scripts/add-likes.ts, scripts/common.ts)
  - Verify: tests for a crafted Calcudoku code and a sparse sudoku grid returning within
    budget, `#%` start-up, and a readLibrary/writeLibrary round-trip; screenshots unchanged
- v1.10 – More sudoku techniques (until Q3 is answered): Finned X-Wing / Swordfish, W-Wing,
  then Unique Rectangle; each with hint texts in all languages, a guide entry with a worked
  example, its place in TECHNIQUES and the rating groups

## Later
- A Str8ts-like puzzle type under its own name (Str8ts is a trademark)
- Tectonic / Suguru as a light type (own name, e.g. themed like the others)
- More sudoku techniques after v1.10: ALS, forcing chains

## Done
- ✓ v1.7 – Language option: interface in English, German, Dutch; no browser auto-translate
- ✓ v1.6 – Play fixes: candidates come back, Futoshiki gap taps, pad highlight, no lingering focus
- ✓ v1.5 – General refactoring round (shared pad code, styles and solvers split)

Older: see CHANGELOG.md
