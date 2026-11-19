# MAP
<!-- Claude-facing. Terse. Update in the same step as code changes. -->

## Entry
- src/ui/app.ts: page entry (esbuild entryPoints); sudoku page, settings, and `initLite(...)` per light type
- src/page.html: markup; build.mjs inlines fonts/CSS/JS → dist/index.html, dist/artifact.html, site/
- scripts/grow.ts: the generator app (SudokuG Generator.cmd), fills dailies and library

## Elements
- Sudoku page: the full sudoku app | src/ui/app.ts, src/ui/board.ts (BoardView) | localStorage `sudokug-*`, settings `pattern-sudoku-settings`
- Light page: shared page of the light types | src/games/lite.ts `initLite` | `sudokug-<type>`
- LiteGame: one light puzzle type (layout, decorate, solver, hooks) | src/games/<type>/game.ts | –
- Puzzle switcher: type dropdown at the top of the Puzzles tab | src/ui/games.ts | remembered
- Pad: number pad; on a phone two rows (sudoku 5+5, light types ceil(keys/2), max 5) | `buildPad` in app.ts and lite.ts | –
- S key: phone-only pad key, held = Shift (add cells, candidates) | `pad-sticky` | option S key stays on
- Sweep: slide a finger over light-type pad keys to toggle candidates in one go | lite.ts `buildPad` | one undo step
- Digit highlight: tapping a pad key with nothing selected marks that digit and its candidates | app.ts `S.padDigit`, lite.ts `S.padDigit` | –
- Selection outline: one outline around each group of selected cells (not Futoshiki: a frame per cell) | board.ts `outlinePath`, lite.ts sel overlay | option Outline the selected cells
- Region lines: thin grid + thick region/cage lines as SVG | lite.ts `linesHtml`, `placeOverlays`, `LiteGame.regions` | –
- Highlight row and column / Highlight box (sudoku) / Highlight region (light types with regions): separate options | Settings.peers/box, LiteOptions.peers/region |
- Candidates (light): framed pill in the middle of the cell | lite.ts `pillHtml` | Snap.cands bitmask
- Ring: Treasure Map "a digit goes here" mark | RING in games/logic.ts | cands === RING
- Smart input: Star Battle tap/drag crosses, double tap star, hold clears | lite.ts smartDown/Move/Up | option
- Cross automatically: Star Battle auto crosses (`autoMarks` hook) | lite.ts `autoDots` | cands === AUTO marks them
- Hint card, Techniques tab, Auto-finish, Check, Reveal | lite.ts / app.ts | –
- Notes: per-cage notes (Calcudoku) | `LiteGame.notes`, lite.ts renderNotes | saved with the game
- Puzzle library, Dailies, Likes, Names, Print dialog | src/library.ts, src/ui/daily.ts, likes.ts, src/names.ts, print-dialog.ts | data files written by scripts
- Colour palettes (sudoku): 3 palettes × 9 colours, 27-bit mask per cell | board.ts `paletteBit` | saved game

## Files
- src/engine/*: sudoku logic, no DOM; index.ts is the only import for the UI (README "File structure" lists each)
- src/ui/app.ts: sudoku state, input, render, generator UI, options, light-type wiring | render(), buildPad(), buildBoard() | engine, board.ts
- src/ui/board.ts: sudoku board DOM, selection outline, links, paint | BoardView, outlinePath() | engine
- src/ui/style.css: all styles; light types from `.lite`; per type `.<id>-board`; phone layout in `@media (max-width: 760px)`
- src/games/lite.ts: light page: markup, state S, editing, pad, selection, smart input, render, overlays, hints, notes, techniques, print, keys | initLite, LiteGame | lite-options, logic, ui/games, ui/print-dialog
- src/games/lite-options.ts: light options per type | liteOptionsFor, LITE_OPTION_TEXT
- src/games/logic.ts: hints, auto-finish for light solvers | liteHint, singlesFinish, RING, DOT
- src/games/latin.ts, latin-steps.ts, draw.ts: shared Latin squares, steps, print pieces
- src/games/<sums|futoshiki|calcudoku|starbattle>/: engine.ts (grid, codes), logic.ts (step solver, rating), game.ts (LiteGame), techniques.ts, examples.ts
- test/engine.test.ts: all engine/solver tests
- scripts/: grow.ts, make-dailies.ts, make-library.ts, add-likes.ts, make-lite-examples.ts, common.ts

## Data flow
pointer/keys → app.ts or lite.ts state → change() pushes undo snapshot → render() → localStorage save

## Docs
- README.md: user + developer manual (features, generator, rating, library, each puzzle type) | read when changing behaviour a user sees, or the generator

## External deps
- esbuild 0.28, typescript 7, @fontsource fonts (inlined). No runtime deps.

## Decisions
- One self-contained HTML page + PWA, no server: offline play, GitHub Pages (inferred, v1.0)
- Light types share one page (lite.ts) with optional LiteGame hooks: consistency, one place to fix (v1.0)
- Options kept per light type: types need different defaults (Star Battle no auto-finish) (v1.0)
- Lines and selection outline as SVG overlays: CSS borders of mixed widths make notched corners (v1.1)
- Futoshiki keeps a frame per selected cell: its cells don't touch (v1.1)
