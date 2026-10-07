# SudokuG

**Play it:** https://sudokug.github.io/SudokuG/

A sudoku player and generator. Hints show the next move a human would find (easiest
technique first), every puzzle gets a difficulty and a "grind" rating, and the generator
makes puzzles of a chosen difficulty where no tedious triple, quad or long chain is ever
the only way forward. On a phone or computer you can install it from the browser
("Add to home screen" / "Install") and play offline.

## Getting started

**Just play:** open the website above. To get a single offline file instead, run the
build below and double-click `dist/index.html`.

**Change the code:** you need Node.js once (https://nodejs.org, the "LTS" version). Then
open a terminal in this folder (in Windows Explorer: click the address bar, type `cmd`,
press Enter) and run:

```bash
npm install        # once: downloads the build tools into node_modules/
npm run build      # turns src/ into dist/index.html
npm test           # checks every logical step against the brute-force solution
npm run typecheck  # checks the TypeScript types
```

After `npm run build`, refresh `dist/index.html` in the browser to see your changes.

**Publish:** push to the `main` branch. GitHub Actions (`.github/workflows/deploy.yml`)
checks the types, runs the tests, builds the site and publishes it on GitHub Pages. If a
test fails, nothing is published.
Tip: `node_modules` holds thousands of small files; if OneDrive syncing them is slow,
keep the project in a folder outside OneDrive.

## File structure

```
src/
  engine/            pure logic, no DOM; the UI only imports from engine/index.ts
    grid.ts          Grid class, units (rows/columns/boxes), peers, candidate bitmasks
    solver.ts        brute-force backtracking solver (counts solutions)
    types.ts         Step, Link, Technique types
    util.ts          shared helpers (positions, sees, combinations)
    basic.ts         singles, locked candidates, naked/hidden subsets
    fish.ts          X-Wing, Swordfish, Jellyfish
    wings.ts         XY-Wing, XYZ-Wing
    coloring.ts      Simple Coloring (color trap and color wrap)
    chains.ts        chain search: Skyscraper/2-String Kite/Turbot, X-Chain, Two-Digit Chain, XY-Chain, AIC
    techniques.ts    the TECHNIQUES list (easiest first, with levels)
    hints.ts         getHint(), applyStep(), logicalSolve()
    rating.ts        ratePuzzle(): difficulty label + grind (forced triples/quads/long chains)
    generator.ts     random minimal puzzle with a unique solution
    targeted.ts      generateRated(): puzzles of a chosen difficulty without grind
    code.ts          encodePuzzle()/decodePuzzle(): shareable puzzle codes
  ui/
    app.ts           state, input modes, rendering, auto-finish, generator UI
    board.ts         the 9×9 board elements, hint highlighting, chain lines, selection outline, colour palettes
    guide-view.ts    the Techniques tab
    stats.ts         local stats (solved, best times, dailies)
    daily.ts         today's daily puzzles, hand-crafted overrides
    likes.ts         liked puzzles
    played.ts        puzzles played in this browser, browser id for shared likes
    style.css        styles (light and dark theme)
  guide.ts           texts of the Techniques tab
  guide-examples.ts  example positions for each technique (found by search, checked by tests)
  guide-step.ts      turns an example position into the step to show
  page.html          page markup; build.mjs inlines fonts, CSS and JS into it
  sw.js              service worker: keeps the game on the device for offline play
  samples.ts         built-in puzzles
  daily-data.ts      generated daily puzzles (do not edit by hand)
  library.ts         picks an unplayed library puzzle, liked ones first
  library-data.ts    the puzzle library and like counts (written by scripts)
scripts/             make-dailies.ts, make-library.ts, add-likes.ts, common.ts (npm run dailies / library / add-likes)
test/engine.test.ts  validation on the samples + N random puzzles (N=300 by default)
public/              icons copied into the website
build.mjs            builds dist/index.html (single file), dist/artifact.html and site/ (website + PWA)
.github/workflows/   test-and-deploy pipeline for GitHub Pages
```

## Candidates are bitmasks

`grid.cands[i]` is a 9-bit number: bit `d-1` set means digit `d` is still possible.
Helpers: `bit(d)`, `popcount(mask)`, `digitsOf(mask)`.

## Adding a technique

1. Write a `Technique` in its own file (fish.ts is a compact example):

   ```ts
   export const myTechnique = (level: number): Technique => ({
     name: "My Technique",
     level,
     find(g) {
       // look at g.values / g.cands, return a Step or null
     },
   });
   ```

   A `Step` lists `placements`, `eliminations`, the pattern `cells` and `candidates`
   (drawn in amber), `units` to shade, optional `links` (lines on the board, solid = strong,
   dashed = weak), optional two-color `colors`, a chain `notation`, a short `nudge`
   (first hint click) and a full `explanation` (second click).
2. Insert it into `TECHNIQUES` in `techniques.ts` at the right difficulty position.
3. Run `npm test`. Any wrong elimination or placement fails the test, and the summary
   shows how many random puzzles now need the new technique.

## Current techniques (in hint order)

Full House, Hidden Single, Naked Single, Locked Candidates (Pointing, Claiming),
Naked Pair, Hidden Pair, Naked Triple, Hidden Triple, X-Wing,
Skyscraper / 2-String Kite / Turbot Fish, XY-Wing, Simple Coloring, XYZ-Wing,
Swordfish, Naked Quad, Hidden Quad, X-Chain, Two-Digit Chain, Jellyfish, XY-Chain,
Alternating Inference Chain.

About 1.5% of randomly generated puzzles still get stuck with these. Candidates for
later: finned fish, W-Wing, uniqueness techniques (Unique Rectangle), ALS, forcing chains.

## Rating

Two kinds of moves count as **grind**:
- triples and quads (naked and hidden): only findable by filling in every candidate and
  searching every unit;
- chains with three or more different digits: closer to solving in your head than to
  spotting a pattern. One-digit chains (X-Chain, Skyscraper, Kite) and two-digit chains are fine.

`ratePuzzle(grid)` solves the puzzle twice:

1. **Easiest first** (normal hint order). The hardest technique on this path gives the
   difficulty: Easy (singles), Medium (locked candidates, pairs), Hard (triples, X-Wing,
   Skyscraper, Kite, Turbot), Expert (wings, coloring, Swordfish), Extreme (quads, chains,
   Jellyfish), Beyond (current techniques get stuck).
2. **Patterns first** (`patternFirst()`): techniques up to Expert first, then triples and
   quads, then other non-grindy techniques (one- and two-digit chains, Jellyfish), and
   multi-digit chains last. A grindy move on this path was the only reasonable way
   forward: **forced grind**. The "Prefer patterns" hint option uses the same order.

Grind score: forced triple 1, forced quad 2, forced chain with 3+ digits 2. Verdict:
0 clean, 1 slightly grindy, 2+ grindy.

Naked and hidden subsets mirror each other (a naked triple in a unit with k empty cells
is a hidden subset of size k-3). Since smaller subsets are tried first, a reported triple
always sits in a unit with 6+ empty cells and a quad in one with 8+. The tests check this.

## Generator and profiles

A **profile** is the set of techniques a puzzle may need (`targeted.ts`). A generated
puzzle can be solved with only those techniques and needs at least one technique from
the hardest group that is switched on. The five templates (Easy … Extreme) switch on
everything up to their group except the grindy techniques (triples, quads, XY-Chain,
AIC); players can tick or untick any technique to make their own mix.

`generateRated({ allowed })` makes random minimal puzzles (180° symmetric) and solves them
with the allowed techniques. Too easy: start over. Stuck: give a clue back where the first
step outside the profile acts and try again (up to 6 times). It yields after every try,
so the page stays responsive; the page gives up after 800 tries (rare custom mixes).

**Enough hard moves.** A random minimal puzzle tends to be singles, one *lock* where the
hard technique is needed, then singles to the end. So for Hard and up, a puzzle also has to
need a number of moves of each group on the easiest-first path (`REQUIREMENTS` in
`targeted.ts`):

| Difficulty | Extreme moves | Expert moves | Hard moves | Separate locks |
|---|---|---|---|---|
| Hard | | | 3 | 2 |
| Expert | | 2 | 3 | 2 |
| Extreme | 1 | 2 | 5 | 3 |

They cascade: a harder move also counts for an easier group, so an Extreme puzzle with four
expert moves needs only three hard ones (internally: at least 1 move of Extreme level, 3 of
Expert level or harder, 8 of Hard level or harder; `missingMoves()`). Hard moves are X-Wing,
Skyscraper, 2-String Kite and Turbot Fish; expert moves XY-Wing, XYZ-Wing, coloring and
Swordfish; extreme moves the chains and Jellyfish. *Separate locks* keeps those moves from
all landing in one spot: hard moves with at least 4 placements between them count as
separate places where you get stuck (`spreadOf()`).

To get there, `moveClues()` moves clues around (take a clue pair out and put one in
elsewhere, or just take one out) and keeps a change when the puzzle keeps one solution,
still fits the profile and misses no more moves than before (ties: more separate locks,
`spreadOf()`). If a candidate gets stuck, the next one is tried. In the browser this runs
for at most 5 seconds and then takes the best one found (on a computer that meets all
requirements for about 8 in 10 Hard, half of Expert and a third of Extreme puzzles; the
rest are usually one move or lock short). Without a time limit they are always met, in
about 3 s (Hard), 6 s (Expert) or 15 s (Extreme) per puzzle, which is why the library
exists.

## Puzzle library

"Generate" first hands out a puzzle from the library (`src/library-data.ts`) that this
browser hasn't played yet: liked puzzles first (most likes first), then a random one. Only
when you've played them all (or tap "Make a brand-new one instead") is a new one made. The
library is made ahead of time with no time limit, so every puzzle in it has all the
required moves: `npm run library` adds puzzles until each difficulty has
`COUNTS="Easy=80,Medium=80,Hard=150,Expert=150,Extreme=150"` (existing puzzles and likes
are kept). Played puzzles are remembered per browser
(`src/ui/played.ts`), so a phone and a computer each have their own list.

**Likes.** After finishing a puzzle you can like it; liked puzzles are listed in the
Puzzles tab. "Copy my likes" copies them as text, headed by a random id for that browser:

```
SudokuG likes k3x9qa
S2skUeu1uG36qNQ2aSVdOZOK
...
```

Players send that text to whoever runs the site, who pastes it (several at once is fine)
into a file and runs `npm run add-likes -- likes.txt`. Each browser's like counts once per
puzzle; the counts are stored in `LIKES` in `src/library-data.ts`. A liked puzzle that
fits a template (solvable with its techniques, rated that difficulty) is added to that
difficulty's library, so other players get it, most-liked first. Then commit and push.

## Colours

Colour mode has three palettes of the same nine colours: solid fills, stripes leaning
right (/) and stripes leaning left (\). Because the colours are the same in each palette,
the pattern tells the palettes apart, and a cell can carry colours of all three at once
(the stripes are drawn over the fill). A cell's colours are one 27-bit mask: bit
`p*9 + d-1` is colour d of palette p (`paletteBit` in `board.ts`). The eye button hides
or shows the current palette. Clear colour clears the current palette in the selected
cells (or every shown palette if the current one has nothing there); holding it clears
every colour of every palette.

## Saving, stats and updates

Everything is stored in the player's own browser (localStorage); nothing is sent anywhere.
- **Games:** the last 12 puzzles played are saved after every change (digits, candidates,
  pairs, colours, undo history, time, hints used) and continue where you left off.
- **Stats:** solved count, best time (games without hints) and average per difficulty,
  and which daily puzzles are done (`src/ui/stats.ts`).
- **Likes and played puzzles:** liked puzzles (`src/ui/likes.ts`) and the puzzles played
  in this browser (`src/ui/played.ts`); see Puzzle library.
- **Timer:** counts only while the page is visible and you have clicked or typed in the
  last 2 minutes.
- **Updates:** the service worker fetches a new version in the background; players keep
  the version they started with and get a small "new version ready" notice.

## Daily puzzles

Five puzzles a day (one per template), the same for everyone, by the player's local date.
They are generated ahead of time by `npm run dailies` (`scripts/make-dailies.ts`) into
`src/daily-data.ts`, so changes to the generator never change a day's puzzles. Hard,
Expert and Extreme dailies made by the current script have all the required moves and
locks (`goodPuzzle()` in `scripts/common.ts`, the same search as the library); the ones in
the file now were made before the requirements existed (spread out, but not counted), and
the tests report how many miss them until `FROM=2026-10-09 npm run dailies` is run again
(about 17 s per day on 2 processes). The current file runs until 2027-11-04; the tests warn when fewer
than 60 days are left. To extend, keep the existing days and add new ones:
`FROM=2027-11-05 DAYS=765 npm run dailies` (DAYS counts from the start of the file; days
before FROM are kept as they are).
Hand-crafted puzzles used with the setter's permission go in `HANDCRAFTED` in
`src/ui/daily.ts` and are shown with "By <author>".

## Puzzle codes

`encodePuzzle(values)` gives a 21-26 character code ("S..." for symmetric puzzles, "A..."
otherwise) that stores the starting digits themselves, so codes keep working when the
generator changes. Paste one into Load, or share a link: `https://sudokug.github.io/SudokuG/#<code>`
opens that puzzle directly (the "Copy link" button under the board makes one).

## Roadmap

1. ~~Playable grid, pencil marks, auto-candidates, undo/redo, import/export~~
2. ~~Engine core, brute-force solver~~
3. ~~Hints with singles, locked candidates and subsets~~
4. ~~Harder techniques (fish, wings, coloring, chains)~~
5. ~~Rating and "grindiness" metrics~~
6. ~~Generator that keeps only puzzles matching a rating filter~~
7. Next: more variety per difficulty, more techniques (finned fish, W-Wing, uniqueness), tuning

## Licence

MIT: anyone may use, copy and change the code, as long as the licence and copyright
notice stay with it. See `LICENSE`.
