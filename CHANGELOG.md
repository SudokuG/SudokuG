# Changelog

Release notes, newest first: per version, very briefly, what changed. Maintained by Claude.
Resolved notes, answered questions and replaced files go to ARCHIVE.md, not here.

## v1.4 (2026-11-19)
- Light types: entering candidates (Candidates, Shift or S) turns the selection, its shading
  and the pad green, as in sudoku's Candidate mode.
- New option "Sweep in digit mode" (every type with candidates): switch it off to sweep
  over the pad only while entering candidates.

## v1.3 (2026-11-19)
- Nothing changes in play: the code behind the sudoku page and the light puzzle page is split
  into smaller files, so later changes are quicker and safer.

## v1.2 (2026-11-19)
- Redo in every puzzle type.
- The light types' pad shows how many of each value are left; finished keys are greyed out.
- Sudoku: sweep over the pad too (candidates, or pairs and colours in those modes).
  "Sweep over the number pad" is an option in every type.
- Sudoku: cells with the highlighted digit as a candidate or pair are shaded lightly
  (option "Shade cells with the candidate").
- Sudoku: option "Outline the selected cells", as in the other types.

## v1.1 (2026-11-19)
- Number pad: keys react to the first touch; holding a key no longer selects text or opens
  a search. On a phone the light types' pad has two rows of wide keys, as in sudoku.
- Slide a finger over the pad keys to fill in several candidates at once (light types).
- Tap outside the grid to select nothing (every type).
- A digit key with nothing selected highlights that digit and its candidates (every type).
- Selected cells get one outline around each group, as in sudoku (Futoshiki: a frame per cell).
- Separate options: "Highlight row and column" and "Highlight box" (sudoku), "Highlight
  region" / "Highlight cage" (Star Battle, Calcudoku).
- Star Battle and Calcudoku: clean corners on the thick lines.
- Treasure Map: the clue column takes only the room it needs, so the grid is bigger.

## v1.0 (2026-11-04)
Everything up to Project Osty, in short:
- Sudoku: playable grid, candidates, pairs, colour palettes, undo, save and resume.
- Hints that show the move a person would find, from singles to chains.
- Difficulty and "grind" rating; sculpted Hard to Extreme puzzles; custom technique mixes.
- Puzzle library, five dailies a day, likes, names, printing, stats, offline install.
- Generator app to make puzzles on your own computer.
- Lighter puzzle types: Treasure Map, Futoshiki, Calcudoku and Star Battle, each with a
  step-by-step solver, levels, hints, a Techniques tab and its own options.
