# MAP
<!-- Claude-facing. Terse. Update in the same step as code changes. -->

## Entry
- src/ui/app.ts: page entry (esbuild entryPoints); sudoku page wiring (init), and `initLite(...)` per light type
- src/page.html: markup; build.mjs inlines fonts/CSS/JS → dist/index.html, dist/artifact.html, site/
- scripts/grow.ts: the generator app (SudokuG Generator.cmd), fills dailies and library

## Elements
- Sudoku page: the full sudoku app | src/ui/app.ts + src/ui/sudoku/*, src/ui/board.ts (BoardView) | localStorage `sudokug-*`, settings `pattern-sudoku-settings`
- Light page: shared page of the light types | src/games/lite.ts `initLite` + src/games/lite/* parts | `sudokug-<type>`
- LiteGame: one light puzzle type (layout, decorate, solver, hooks) | src/games/<type>/game.ts | –
- Puzzle switcher: type dropdown at the top of the Puzzles tab | src/ui/games.ts | remembered
- Pad: number pad; on a phone two rows (sudoku 5+5, light types ceil(keys/2), max 5) | `buildPad` in sudoku/pad.ts and lite/pad.ts | –
- S key: phone-only pad key, held = Shift (add cells, candidates) | `pad-sticky`, ui/pad-common.ts `wireSKey` | option S key stays on
- Sweep: slide a finger over pad keys to toggle candidates in one go | ui/pad-common.ts `wireSweep` (pointer, keys, add/remove) + hooks in sudoku/pad.ts `wirePadSweep` (modes) and lite/pad.ts `wirePad` (rings) | options sweep, sweepDigit (also in digit mode); one undo step
- Entry mode colours: digit blue, candidates green (sudoku also pairs, colour) on board, outline and pad | sudoku: `.board.mode-<m>`, `.pad.pad-<m> base-<m>` (render.ts renderModes); light: `.lite.mode-pencil` on the page root + `.pad-pencil`/`.base-pencil` (lite/render.ts) | CSS vars --sel --accent --b-peer --b-same, one rule set in styles/2-board.css
- Digit highlight: tapping a pad key with nothing selected marks that digit and its candidates | sudoku/state.ts `S.padDigit`, lite/ctx.ts `S.padDigit` | –
- Selection outline: one outline around each group of selected cells (not Futoshiki: a frame per cell) | board.ts `outlinePath`, lite/render.ts sel overlay | option Outline the selected cells
- Region lines: thin grid + thick region/cage lines as SVG | lite/markup.ts `linesHtml`, lite/render.ts `placeOverlays`, `LiteGame.regions` | –
- Highlight row and column / Highlight box (sudoku) / Highlight region (light types with regions): separate options | Settings.peers/box, LiteOptions.peers/region | region off by default (user, v1.2)
- Shade cells with the candidate (sudoku): cand-same shading for the highlighted digit | Settings.candShade | light types always shade
- Pad counts: value left per key, `.done` greys a finished key | renderModes (sudoku/render.ts), render (lite/render.ts) | options padCounts
- Undo/Redo: both pages; lite/editing.ts pushUndo() clears redo | S.undo/S.redo | not saved
- Candidates (light): framed pill in the middle of the cell | lite/markup.ts `pillHtml` | Snap.cands bitmask
- Ring: Treasure Map "a digit goes here" mark | RING in games/logic.ts | cands === RING
- Smart input: Star Battle tap/drag crosses, double tap star, hold clears | lite/pointer.ts smartDown/Move/Up | option
- Cross automatically: Star Battle auto crosses (`autoMarks` hook) | lite/editing.ts `autoDots` | cands === AUTO marks them
- Hint card, Auto-finish, Check, Reveal | lite/editing.ts, sudoku/actions.ts | –
- Techniques tab | lite/guide.ts, ui/guide-view.ts | –
- Notes: per-cage notes (Calcudoku) | `LiteGame.notes`, lite/render.ts renderNotes | saved with the game
- Puzzle library, Dailies, Likes, Names, Print dialog | src/library.ts, src/ui/daily.ts, likes.ts, src/names.ts, print-dialog.ts | data files written by scripts
- Colour palettes (sudoku): 3 palettes × 9 colours, 27-bit mask per cell | board.ts `paletteBit` | saved game

## Files
- src/engine/*: sudoku logic, no DOM; index.ts is the only import for the UI (README "File structure" lists each)
- src/ui/app.ts: sudoku page entry: applyTheme, keys (onKey, move), copyText, init() wiring, update toast | init() | ui/sudoku/*
- src/ui/sudoku/ (module-level code, parts import each other's functions):
  state.ts (Settings, S, Snapshot, candidates shown) · puzzles.ts (load, save/restore, timer) · finish.ts (stats, solved card, likes, dailies) · generate.ts (library/generator runs, technique toggles, rating card) · printing.ts · actions.ts (change/afterChange, enterNumber, erase, colours, undo, auto-finish, hints, check, select) · pad.ts (buildPad, wirePadSweep hooks, Erase button) · options.ts (SUDOKU_OPTIONS, HINT_OPTIONS table → #opt-list/#opt-hints; buildOptions wires, renderOptions ticks) · render.ts ($, buildBoard, render, setMode, setTab)
- src/ui/pad-common.ts: shared by both pads | wireSweep(pad, attr, SweepHooks), wireSKey(button, hooks)
- src/ui/option-label.ts: OptionText, optionLabel(attr, title, text): one option's markup, both pages
- src/ui/board.ts: sudoku board DOM, selection outline, links, paint | BoardView, outlinePath() | engine
- src/styles/N-*.css: all styles, joined by number in build.mjs (cascade order matters): 1-base (theme vars), 2-board (sudoku board, entry-mode colours), 3-panel (pad, modes, outline), 4-tabs (tabs, options, techniques, generator), 5-sudoku-phone, 6-cards (solved, likes, daily, stats, switcher), 7-lite (light page), 8-lite-types (per type `.<id>-board`, overlays, notes), 9-print; phone layout in `@media (max-width: 760px)` blocks
- src/games/lite.ts: initLite: builds the context, makes the parts, setTab, renderOptions, timer, button wiring, shared links | initLite | lite/*
- src/games/lite/ (one page per type, so closures: each part is `<name>Part(ctx)` returning its functions; initLite puts them on ctx; other parts call them as ctx.fn()):
  types.ts (LiteGame, LitePuzzle, LiteTechnique, Snap, Tab) · ctx.ts (newState = S, LiteBase, LiteParts: every cross-part function) · markup.ts (page HTML, pillHtml, linesHtml, rulesHtml) · puzzles.ts (start, make, save/restore, stats, print, copyLink) · editing.ts (change, enter, candidates, rings, undo/redo, autoDots, auto-finish, check, reveal, hint) · render.ts (buildBoard, overlays, render, notes) · pointer.ts (selection, right-button X's, smart input, outside tap) · pad.ts (buildPad, S key, sweep) · keys.ts (onKey, move) · guide.ts (Techniques tab, worked examples) · options.ts (liteOptionsFor, LITE_OPTION_TEXT)
- src/games/logic.ts: hints, auto-finish for light solvers | liteHint, singlesFinish, RING, DOT
- src/games/latin.ts, latin-steps.ts, draw.ts: shared Latin squares, steps, print pieces
- src/games/<sums|futoshiki|calcudoku|starbattle>/: engine.ts (grid, codes), logic.ts (step solver, rating), game.ts (LiteGame), techniques.ts, examples.ts
  - starbattle: state.ts (StarState, unitsOf, place, why) · steps.ts (finders, FINDERS_1/2) · logic.ts (shortChain, trial, nextStep, logicSolveStars, rateStars, makeStars; re-exports state)
  - sums: lines.ts (Shape, Line, linesOf, lineWays, lineArrangements, staticWays) · logic.ts (state, steps, trial, rating, making)
- test/engine.test.ts: all engine/solver tests
- scripts/: grow.ts, make-dailies.ts, make-library.ts, add-likes.ts, make-lite-examples.ts, common.ts

## Data flow
pointer/keys → sudoku/actions.ts or lite/editing.ts change() pushes undo snapshot → render() → localStorage save

## Docs
- README.md: user + developer manual (features, generator, rating, library, each puzzle type) | read when changing behaviour a user sees, or the generator

## External deps
- esbuild 0.28, typescript 7, @fontsource fonts (inlined). No runtime deps.

## Decisions
- One self-contained HTML page + PWA, no server: offline play, GitHub Pages (inferred, v1.0)
- Light types share one page (lite.ts) with optional LiteGame hooks: consistency, one place to fix (v1.0)
- Shared pad code (v1.5): one wireSweep/wireSKey with per-page hooks, since the two pages' state differs (sudoku modes and Snapshot vs light Snap and rings)
- Styles as numbered files joined in order, not @import: one inlined page, and the cascade order stays visible (v1.5)
- Split by parts, not by puzzle type (v1.3): app.ts and lite.ts were ~2000 lines. The light page stays one closure per type, so its parts share a context object (lite/ctx.ts) instead of module state; sudoku has one page, so plain modules
- Options kept per light type: types need different defaults (Star Battle no auto-finish) (v1.0)
- Lines and selection outline as SVG overlays: CSS borders of mixed widths make notched corners (v1.1)
- Futoshiki keeps a frame per selected cell: its cells don't touch (v1.1)
- Not aligned on purpose (Q1, v1.2): candidate pills stay as they are; Star Battle smart input keeps its unmarked cursor; region highlight stays off by default; sudoku keeps Fill/Clear candidates, light types keep Reveal
