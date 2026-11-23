# CLAUDE.md

Osty: 0.10
Versions: v1.1 → v1.2 → v1.3 …; constant: "version" in package.json (v1.3 written as 1.3.0)
This project uses the project-osty skill (Project Osty). Every session: read the global
and project PREFERENCES.md and NOTES.md; read MAP.md before touching code; work from
ROADMAP.md "Now"; update MAP/ROADMAP/CHANGELOG/ARCHIVE/NOTES/PREFERENCES in the same
step as the code; end with the Done/Next/Roadmap report. This file wins over the skill
for this project.

## Project
SudokuG: sudoku player and generator (human-style hints, rated puzzles without grind) plus
lighter puzzle types (Treasure Map, Futoshiki, Calcudoku, Star Battle). Static PWA, played
mostly on a phone. Live at https://sudokug.github.io/SudokuG/

## Run & test
- `npm ci` once; `npm run build` → dist/index.html (open it), site/ (GitHub Pages)
- Before every commit: `npm run typecheck && npm test && npm run build`
- Push to main = deploy (.github/workflows/deploy.yml: typecheck, test, build, Pages).
  A failing test blocks the deploy.
- Look at the page: build, then Playwright (installed globally) on dist/index.html at a
  phone size (390×844) and a desktop size; screenshots for any visual change.
- A change that should not change the page (refactoring): screenshot every type and tab
  (light/dark, phone/desktop, fixed puzzle codes via #code) before and after; compare pixels.

## Technical conventions
- TypeScript, no framework, bundled by esbuild (build.mjs inlines CSS, JS, fonts into one page).
  noUnusedLocals/Parameters on: unused code fails the typecheck (`_` for an unused parameter).
- src/engine/ and src/games/*/engine.ts, logic.ts: no DOM; tested in test/engine.test.ts.
- UI text: British spelling (colour, centre), plain words. Every text the player sees goes
  through `t("English")` (src/ui/i18n.ts) and gets a row [English, German, Dutch] in
  src/ui/lang/texts-*.ts (the tests fail on a missing row); static markup is translated by
  `translateTree`. Names of types, techniques and puzzles stay English. Not yet translated:
  technique explanations, hint texts, Rating card.
- README.md is the full user and developer manual: every user-visible change also updates
  its section there (Other puzzle types, Options, …).
- Generated data (src/daily-data.ts, src/library-data.ts): never edit by hand.
- localStorage keys start with `sudokug-` (sudoku settings: `pattern-sudoku-settings`).
  Never break saved games or settings: new fields get defaults when read.

## Patterns
- Puzzle type: a `LiteGame` in src/games/<type>/game.ts (+ engine.ts, logic.ts,
  techniques.ts, examples.ts); the shared page is src/games/lite.ts + src/games/lite/. Adding a
  type: README "Other puzzle types", last paragraph.
- Optional behaviour of a type = an optional `LiteGame` hook, never `if (g.id === …)` in the light page.
- Light page parts (src/games/lite/*.ts): `<name>Part(ctx)` returns its functions; a function
  another part calls goes in `LiteParts` (lite/ctx.ts) and is called as `ctx.fn()`; shared state
  lives in `ctx.S` (newState) or on `LiteBase`. Sudoku parts (src/ui/sudoku/) are plain modules.
- Files stay under ~400 lines: a part that grows past that is split along its sections.
- Options: sudoku in `Settings` (sudoku/state.ts) + a line in `SUDOKU_OPTIONS` (sudoku/options.ts);
  light types in src/games/lite/options.ts (`LiteOptions`, `LITE_OPTION_TEXT` with `for:` to limit
  types). New fields get a default.
- Pad keys act on pointerdown (phones drop clicks). Sweep and the S key: src/ui/pad-common.ts,
  each page gives hooks (sudoku/pad.ts, lite/pad.ts); change behaviour there, once.
- Styles: src/styles/N-*.css, joined by number (order = cascade); entry-mode colours are one
  rule set for `.board` and `.lite`.
- Board lines and the selection outline: SVG overlays (viewBox 100 per cell,
  non-scaling strokes, square caps), not CSS borders.

## Notes for Claude
- The claude.ai Project has an old README copy (claude/pattern-sudoku-readme.md); the repo
  README wins.
