# SudokuG

**Play it:** https://sudokug.github.io/SudokuG/

A sudoku player and generator. Hints show the next move a human would find (easiest
technique first), every puzzle gets a difficulty and a "grind" rating, and the generator
makes puzzles of a chosen difficulty where no tedious triple, quad or long chain is ever
the only way forward: few clues, lots of X-Wings, Skyscrapers, Kites and hidden pairs.
Every puzzle has a (food) name, and puzzles can be printed or saved as PDF. Next to sudoku
there are lighter puzzle types, made on the spot: Treasure Map, Futoshiki, Calcudoku and
Star Battle (see
below). On a phone or computer you can install it from the browser
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
    sculpt.ts        sculpting Hard and up to a recipe (RECIPES), placeSingles()
    code.ts          encodePuzzle()/decodePuzzle(): shareable puzzle codes
  ui/
    app.ts           state, input modes, rendering, auto-finish, generator UI
    board.ts         the 9×9 board elements, hint highlighting, chain lines, selection outline, colour palettes
    guide-view.ts    the Techniques tab
    stats.ts         local stats (solved, best times, dailies)
    daily.ts         today's daily puzzles, hand-crafted overrides
    likes.ts         liked puzzles
    print.ts         printing: puzzle SVGs and page layouts
    played.ts        puzzles played in this browser, browser id for shared likes
    style.css        styles (light and dark theme)
  guide.ts           texts of the Techniques tab
  guide-examples.ts  example positions for each technique (found by search, checked by tests)
  guide-step.ts      turns an example position into the step to show
  page.html          page markup; build.mjs inlines fonts, CSS and JS into it
  sw.js              service worker: keeps the game on the device for offline play
  games/lite.ts      the page shared by the lighter puzzle types (tabs, pad, hints, timer, saving, …)
  games/lite-options.ts  their options; games/logic.ts: steps, hints and auto-finish for their solvers
  games/latin.ts     random Latin squares and base-62 codes; games/draw.ts: print pieces
  games/sums/        Treasure Map: engine.ts (grid, clues, brute-force solver, codes),
                     logic.ts (step-by-step solver, rating, levels), game.ts (board, printing)
  games/futoshiki/   Futoshiki: the same three files; all also have techniques.ts (the
                     Techniques tab) and examples.ts (worked examples, npm run lite-examples)
  games/calcudoku/   Calcudoku: the same
  games/starbattle/  Star Battle: the same (engine.ts also grows the regions)
  games/latin-steps.ts  steps shared by the Latin-square puzzles (singles, pairs, triples)
  ui/games.ts        the puzzle-type switcher in the header
  ui/print-dialog.ts the print dialog, shared by all puzzle types
  samples.ts         built-in puzzles
  daily-data.ts      generated daily puzzles (do not edit by hand)
  library.ts         picks an unplayed pool puzzle (library, missed dailies, old), custom-mix search
  names.ts           puzzle names (one theme per puzzle type; sudoku is food)
  library-data.ts    the puzzle library, older puzzles and like counts (written by scripts)
scripts/             grow.ts (the generator app), make-dailies.ts, make-library.ts, add-likes.ts, common.ts
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

**Easy and Medium:** `generateRated({ allowed })` makes random minimal puzzles (180°
symmetric) and solves them with the allowed techniques. Too easy: start over. Stuck: give a
clue back where the first step outside the profile acts and try again (up to 6 times).

**Hard and up are sculpted** (`sculpt.ts`), roughly the way a setter works:
1. Start from a random full grid and take clues away (in symmetric pairs, random order) for
   as long as the puzzle stays solvable with the allowed techniques and within the caps
   below. What is left has about as few clues as those techniques allow. (`staged: true`
   takes clues away with the Hard techniques first and the full set after; in tests it was
   no faster, so it is off.)
2. Grids whose first puzzle is far from the recipe are dropped right away (most are).
3. The rest are improved by moving clues: take a clue pair out and try every empty spot to
   put one back, keeping the best result that is still solvable within the caps, or put a
   few back and take clues away again in a new order. Up to about 60 moves per grid.

Nothing here needs the brute-force solver: a puzzle that the (sound) techniques solve all
the way has exactly one solution.

**Recipes** (`RECIPES` in `sculpt.ts`), counted on the easiest-move-first solve path, so
every counted move was really needed at that moment:

| Difficulty | Pattern moves | of which X-Wing-type | Hidden pairs | Hardest moves | Locks | Clues |
|---|---|---|---|---|---|---|
| Hard | 5+ | 3+ | 1+ | | 2+ | ≤ 26 |
| Expert | 5+ | 3+ | 1+ | 1–3 expert | 2+ | ≤ 26 |
| Extreme | 5+ | 3+ | 1+ | 1–2 extreme, ≤ 3 expert | 2+ | ≤ 26 |

*Pattern moves* are X-Wing-type moves (X-Wing, Skyscraper, 2-String Kite, Turbot Fish) and
hidden pairs together. The hardest moves are **capped**, not just counted: an Extreme puzzle
gets its one or two chains (or a Jellyfish) and does the rest with patterns, instead of a
string of two-digit chains. A *lock* is a place where singles run dry and a pair, X-Wing or
harder is needed; locks at least 4 placements apart count separately. For a custom mix the
recipe of its hardest group is used.

How long it takes (one core of a 2-core cloud machine; a desktop is usually faster): Hard
and Expert about 27 s, Extreme about 40 s per puzzle on average, with a wide spread (a few
seconds to two minutes). In the browser the generator stops after 5 seconds and takes
the best puzzle so far (usually a few pattern moves short), which is why the library exists.

`placeSingles()` places all singles in one quick pass during generation (singles always
come first, and their order doesn't change where the next pattern is needed); the chain
search keeps its link graph per position. Both give exactly the same moves as the
step-by-step solver, which the tests check.

## Puzzle library

"Generate" first hands out a puzzle this browser hasn't played yet (`src/library.ts`):
1. liked puzzles, most likes first;
2. a random one from the library (`LIBRARY` in `src/library-data.ts`) **or from the daily
   puzzles you missed** (days from `MISSED_FROM` up to yesterday);
3. older puzzles (`OLD_LIBRARY`: made before the current recipes).

Only when you've played them all (or tap "Make a brand-new one instead") is a new one made.
**Custom mixes** also look in the pool first: for up to 1.5 seconds the page solves pool
puzzles of the hardest ticked group and its neighbours with your techniques, and takes the
first one that fits (solvable with your ticks, and using at least one of the hardest group).
For unusual mixes it often finds nothing; then a new one is made.

The library is filled by the generator app (below) and by `npm run library`, which adds
puzzles until each difficulty has `COUNTS="Easy=80,Medium=80,Hard=150,Expert=150,Extreme=150"`
new ones. Every new puzzle retires one from `OLD_LIBRARY`, so the library keeps its size
while it turns over. Played puzzles are remembered per browser (`src/ui/played.ts`), so a
phone and a computer each have their own list.

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
difficulty's library, so other players get it, most-liked first (a liked old puzzle moves
from `OLD_LIBRARY` to the front). Then commit and push.

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

## Making puzzles on your own computer

Good Hard, Expert and Extreme puzzles take seconds each to find, so there is a small app
to let your own computer do it while you leave it on: `scripts/grow.ts`.

**Once:**
1. Install Node.js, the "LTS" version, from https://nodejs.org.
2. Install GitHub Desktop from https://desktop.github.com and sign in with your GitHub
   account. Then File > Clone repository > `SudokuG/SudokuG`, into a folder outside
   OneDrive (OneDrive struggles with the thousands of small files in `node_modules`).

**Each time:**
1. In GitHub Desktop, click "Fetch origin" (and "Pull" if it offers that), so you start
   from the latest version.
2. Double-click **SudokuG Generator.cmd** in that folder. A black window opens (leave it
   open) and then a page in your browser. The first time it installs the build tools,
   which takes a minute.
3. Choose how many cores to use (2 by default; it runs at low priority, so the computer
   stays usable) and press **Start**. Press **Stop** whenever you like, and
   **Close the generator** when you're done (or just close the black window).
4. In GitHub Desktop you'll see `src/daily-data.ts` and `src/library-data.ts` changed.
   Type a summary like "More puzzles", click "Commit to main", then "Push origin". The
   site updates about a minute later.

What it does: each good puzzle (meeting its recipe) is saved the moment it's found:
1. it replaces a Hard, Expert or Extreme **daily** that doesn't meet its recipe, soonest day
   first, starting from the day after tomorrow (so nobody's current daily changes);
2. once they all do, it collects one of each and adds **new days** at the end (Easy and
   Medium made on the spot), until the dailies run a year (365 days) ahead;
3. after that it goes to the **library** that "Generate" hands out, retiring one old puzzle.

So after a change to the recipes, the next weeks of dailies get the new puzzles first, and
the library turns over after that. The three difficulties are made in turn, so they grow
evenly. Stopping loses only the puzzles being worked on at that moment. Puzzles waiting for
a new day are kept in `scripts/grow-pool.json` (not committed). On a Mac or Linux, run
`npm install` once and then `npm run grow` in the folder.

## Daily puzzles

Five puzzles a day (one per template), the same for everyone, by the player's local date.
They are made ahead of time into `src/daily-data.ts` by the generator app (above) or
`npm run dailies` (`scripts/make-dailies.ts`), so changes to the generator never change a
day's puzzles by themselves. Hard, Expert and Extreme dailies meet their recipe
(`goodPuzzle()` in `scripts/common.ts`); the tests report how many from 2026-11-02 on don't
yet. The tests warn when fewer than 60 days are left. `make-dailies` keeps days before FROM:
`FROM=2027-11-05 DAYS=765 npm run dailies` (DAYS counts from the start of the file).
A daily you didn't play goes into your own pool for "Generate" (see Puzzle library).
Hand-crafted puzzles used with the setter's permission go in `HANDCRAFTED` in
`src/ui/daily.ts` and are shown with "By <author>".

## Names

Every puzzle has a name, picked from the puzzle itself, so it is the same everywhere (on
every device, in a shared link, on paper): "Smoky Mango Dumplings", "Flaming-Hot Potato
Crisps" (`src/names.ts`). Each type of puzzle gets its own theme; sudoku is **food**. A name
is a word that matches the difficulty (Easy: mild, creamy, poached… Medium: savoury, grilled,
toasted… Hard: smoky, seared, pickled… Expert: fiery, sizzling, devilled… Extreme:
flaming-hot, charred, volcanic… custom mixes: fusion, deconstructed, sprinkled…), an
ingredient (left out in about one name in four) and a dish. To add words, add them to the
lists; existing puzzles may then get other names.

## Printing

"Print" under the board prints the current puzzle; if you've filled anything in, you can
choose the empty puzzle or the puzzle with your digits, candidates, pairs and colours.
"Print … puzzles" in the Puzzles tab (above Techniques) prints several of the chosen
difficulty or mix: unplayed pool puzzles first, new ones made when needed; printed ones
count as played. The dialog sets puzzles per page (1, 2, 4 or 6) and what goes with each
puzzle (name, difficulty, code); the choices are remembered. The browser's print window does
the rest, including "Save as PDF". Pages are built in `#print-root` (`src/ui/print.ts`)
and shown only when printing; puzzles are SVG, always black on white, also in dark mode.
Pressing Ctrl+P prints the current puzzle the same way instead of the whole page.

## Other puzzle types

The **Puzzle** dropdown at the top of every Puzzles tab chooses the puzzle type (the header
stays free for the puzzle's name); the choice is remembered, and a link to a puzzle opens
its type. Sudoku keeps the full app (`src/ui/app.ts`); the lighter
types share one page laid out like sudoku's (`src/games/lite.ts`): Play, Puzzles, Options
and Techniques tabs; the code row under the board (at the bottom on a phone). Play has the
pad, Undo, Erase, Candidates, Hint, Check and Reveal.

- **Candidates** sit in the middle of the cell, small and framed, in the colour of entered
  digits. In Treasure Map, candidates also say "not an X" unless ✕ is one of them; an empty
  ring (the ring key, `.` or `O`) means "a digit goes here" without noting which; it is drawn
  exactly like a candidate frame (an invisible digit sizes it). Holding the ring key or `O`
  for 2 seconds clears every ring (the key fills up while you hold it). On a computer,
  right-clicking a Treasure Map cell puts in an X.
- **Selecting** works as in sudoku: a tap selects a cell, dragging adds the cells you pass.
  The S key (phones) adds more groups: the selection is kept, and so is the highlight of
  the first selected digit; tapping a selected cell drops it; while S is held, digits go in
  as candidates (the keys act on the touch itself, since phones often send no click for a
  second finger). On a computer Shift adds cells and Ctrl toggles them.
- **Number pad**: Shift+number pad enters candidates (on Windows it arrives as an arrow
  key, so the number pad is read by its key code before the arrows). The option "Keyboard number
  pad enters candidates" (sudoku and the light types) makes the number pad always enter
  candidates, which never overwrite digits; off, it works like the other digit keys.
- **Go to Play after making a puzzle** (option, on by default, sudoku too): a newly made puzzle opens the Play tab.
- **Highlight the same digit** (option): selecting a digit also lightly shades the cells that
  have it as a candidate, with that candidate picked out in the pill, to see patterns.
  Candidates removed again leave nothing behind (the ring is only for Treasure Map). In
  Futoshiki every selected cell gets the frame, and cells with the matching candidate get
  the selected-cell shade.
- **Right mouse button** (Treasure Map; Star Battle without smart input): click or drag to put an X in every
  open cell you pass (digits and stars stay); a plain right-click on an X takes it away.
  One undo step. A long press on a phone puts in an X.
- **Check** counts only your own entries. **Auto-finish** (option, default the last 8
  cells): when everything entered is right and the rest follows from singles, it fills in.
- **Options** are kept per puzzle type (`liteOptionsFor` in `src/games/lite-options.ts`,
  saved as `sudokug-lite-options-<type>`; the first time, a type starts from the old shared
  choices, with its own defaults on top: Star Battle has auto-finish off). The Options tab
  only lists what applies to the type. "Outline the selected cells" (on by default) can turn
  the selection frame off. The theme is the site-wide one.
- **Techniques**: the rules, then each technique of the solver with what it is, why it
  works, how to spot it, and a worked example from a real puzzle (shown in place of the board, with where to
  look, what follows and what is ruled out). The examples (`src/games/<type>/examples.ts`)
  are found by `npm run lite-examples` (for Trial it prefers a short chain); the tests check
  that each still shows its technique.
- **Notes** (Calcudoku): a note per cage for working out products and combinations, never
  filled in for you. On a computer they are listed beside the board: the selected cage
  always has a field, notes with text stay listed, empty ones hide again. On a phone, a bar
  under the board shows the selected cage's note. The cage's cells are shaded while you
  type. Notes are saved with the game (`LiteGame.notes`).

Each type is a `LiteGame` in `src/games/<type>/game.ts` (board layout, extra marks such as
clue or sign states, print drawing, its solver, techniques) with its logic in `engine.ts`
and `logic.ts` (no page code, tested in `test/engine.test.ts`). A puzzle is made when you
ask for one (no generator app, no library). Each type has its own name theme
(`src/names.ts`). To add a type: write its engine, logic, techniques and `LiteGame`, add it
to `GAMES` in `src/ui/games.ts`, give it a `<main>` in `page.html`, an `initLite(...)` line in
`app.ts`, and run `npm run lite-examples`.

**Step-by-step solvers.** Every type has one (`logic.ts`), like the sudoku engine: it
solves the way a person does, easiest step first. It rates puzzles, so every size comes in
Easy, Medium, Hard and Expert, and it gives the hints (first click: where to look; second:
the reasoning; Apply carries it out). Hints first point out wrong entries, rings on X's and
candidates that leave out the right value. Treasure Map hints give one step at a time
(where an X must or can't be, or a digit). Futoshiki hints go straight to the next digit you
can place and explain only the pieces it needs ("r5c3 > r5c4, so r5c3 isn't 1; …"), so they
work without candidates written down (`liteHint` in `src/games/logic.ts`). A puzzle the
steps solve completely has exactly one solution, which is also how the generators check
uniqueness (much faster than brute force).

**Treasure Map** (theme: pirates). Puzzle fans call this kind *Japanese Sums*; Denksport
Logisch calls it "Japans vierkant". Every row and column holds 1 to n-2 once and two X's;
the clues are the sums of the runs of digits, in order. 6×6, 7×7 or 8×8. The solver's steps,
by what you need to keep track of:
- with what you can see (placed digits, X's and rings): Single, Hidden Single, Last X's;
  Clue X's: one line's clue (every way to put its X's and split the digits into groups that
  add up to the clue) shows where an X must or can't be, or fixes a cell;
- with candidates written down: Candidate Single, Clue Groups (the same line reasoning on
  the candidates), Line Arrangements (with the order inside the groups);
- Trial (assume a value, find a contradiction).

**Trial** (all three types; `latinTrial`/`trialChain` in `src/games/latin-steps.ts`)
assumes a value in a cell with few possibilities and follows the easier steps until
something breaks: a cell with nothing left, a digit with no place in a line, a broken sign,
a cage or line clue that can no longer be met (`why()` in each `logic.ts`). The explanation
shows the chain from the assumption to that point, only the placements that matter ("r1c1
would be 5, its only digit left; r4c4 would be 5, the only place for 5 in row 4; and then
r3c5 would have no digit left"); of the first few values that break, the one with the
shortest chain is used.

Rating: each step weighs what it asks (line steps: the ways still open plus how many the
clue allows at all); the difficulty is the total plus 4 per step of the longest stretch of X
reasoning before a digit is placed. Expert also means needing candidates. Cut-offs per size
(`SUMS_CUTS`) come from the spread of random grids (Easy: the lower 35%, Medium up to 75%,
Hard up to 95%, Expert the top 5%). A puzzle is a random grid kept when the steps solve it
from the clues alone, so no cells are ever given; about 10-100 ms. Codes look like `J7-…-…`.

**Futoshiki** (theme: Arthurian legend). Every row and column holds 1 to n once; the signs
between cells point at the smaller digit. 5×5, 6×6 or 7×7. Steps: Single, Hidden Single,
Sign Chain (a chain of 3+ signs one way: each cell's range follows from its place in the
chain), Sign (one sign narrows its two cells), Naked and Hidden Pair and Triple, X-Wing, Trial. Easy and
Medium need singles and signs (by total effort, `FUTO_CUTS`), Hard pairs or triples or more
effort, Expert up to 3 trial steps. Making one (`makeFutoshiki`): a minimal puzzle (as few
clues as keep one solution); for easier levels, clues are added where the solve gets stuck
until it is no harder than asked; then every sign and digit whose removal keeps the puzzle
at its level is taken away, pass after pass, so every clue that is left helps. Expert
puzzles stay minimal. About 10 ms to 1 s; codes look like `F6-…-…-…`.

**Calcudoku** (theme: overcomplicated engineering terms; also known as KenKen, a trademark).
Every row and column holds 1 to n once; thick lines make cages whose digits add (+),
multiply (×), or in two cells differ (−) or divide (÷) to the target; one-cell cages are
given. 5×5, 6×6 or 7×7. Steps: Single, Hidden Single, Cage Options (every way to fill a cage
with the digits still possible; up to 3 ways is easy), Naked and Hidden Pair, Must-Have Digit
(a digit every way of a cage uses, always in one line, leaves the rest of that line), Naked
and Hidden Triple, X-Wing, Trial. Rating as Futoshiki (`CALC_CUTS`); for Easy to Hard the
generator skips the slow trial check (a puzzle that needs trial isn't one of those). A puzzle is a random Latin
square with random cages (smaller cages for easier levels), kept when the steps solve it at
the asked level; most random cagings have more than one solution and are dropped (7×7 Easy
and Expert use their own cage mix, which hits those levels more often). About 20 ms to 1 s. Codes look like `K6-…-…-…` (solution, cage of each cell, the
operation of each cage; the targets follow).

**Star Battle** (theme: sci-fi battles and tech). Place stars so that every row, column and
region (the areas inside the thick lines) holds one, never touching, not even diagonally.
6×6 and 8×8 have one star per unit, 10×10 two (the classic size). No digits and no
candidates: the pad has a star and a cross (an empty cell); `1` or `*` places a star, `0`,
`X` or `.` a cross. Stars that break a rule and crosses that leave a unit without room turn
red.

*Smart input* (option, on by default; `smartDown`/`smartMove`/`smartUp` in `lite.ts`, for
types with `smartInput`): a tap or click crosses a cell (again: clears it; a star stays),
dragging crosses every open cell passed, a double tap or double-click toggles a star (the
first tap is undone, so it is one undo step), holding a cell (450 ms; it sinks a little
meanwhile) or right-clicking clears it, and right-dragging clears every cell passed. With
Shift or S held, taps and drags select instead (rounded frames); the star and cross keys
fill the selection, holding or right-clicking inside it clears it, and tapping anywhere
outside the grid (not on a control) drops it. A tapped cell is a quiet cursor (`S.quiet`:
no frame, no row/column shading) that the keyboard can still use. Without smart input, the
board works like the other types (select, then a key; right-drag crosses).

"Cross automatically" (option, on by default): a star crosses the cells around it, and the
rest of its row, column or region once that has all its stars; taking the star away removes
those crosses again (they are marked in the unused candidates, `autoMarks` hook). The
crosses appear in a quick wave outwards from the star (30 ms per cell of distance,
`ripple()`; each mark scales in, `prefers-reduced-motion` turns it off; cells are only
rewritten when their content changes, so marks animate once). The puzzle is solved as soon
as all stars are right; the open cells left fill with crosses (`isSolved` hook).

Look: every region has its own soft colour (`regionHues`: a hand-picked set of hues,
neighbours as far apart as possible; pastel in light mode, muted in dark), crossed cells are
a little darker, starred cells softly lit. Stars have rounded tips and a faint shine. Printed
puzzles stay white with black lines.
The shared page takes all this from optional `LiteGame` hooks (`candidates: false`,
`glyph`, `valueName`, `keyAliases`, `clashes`, `autoMarks`, `isSolved`, `smartInput`,
`optionDefaults`, `sizeLabel`, `controls`); stars are the value 1, crosses the X (0).

Making one (`engine.ts`): random stars first (k per row and column, none touching), then
regions grown around them (each region starts from its stars; with two stars, a short path
joins them), then, while another solution exists, one of its stars is moved into a
neighbouring region, which breaks that solution and keeps ours (`uniquify`, checked with a
row-by-row solution counter). On the 10×10 board some regions are kept small (`skew`),
since tight regions are what makes two-star puzzles solvable without trial.

Steps (`logic.ts`): Around a Star, Full Unit, Last Cells (level 1); Shared Neighbour (a cell
touching every place left for a unit's star), Confined Unit (a region inside one line, or a
line inside one region, that need as many stars: the rest is empty); Squeeze (a star here
would leave some unit without room); on the two-star board Blocks (a unit's open cells in
two 2×2 blocks: one star each) and Pair Blocks (two neighbouring lines cut into 2×2 blocks:
when only as many blocks are open as stars needed, each holds one); Region Groups (2-4
regions inside as many lines, or the other way round: the counting move); Short Chain (assume
a star or a gap, follow only the level-1 steps for a few moves, find a contradiction);
Trial. Rating: the step total against per-size cut-offs (`STAR_CUTS`), bounded by the
hardest step (Region Groups and Pair Blocks at least Medium, Short Chain at least Hard,
Trial Expert). Making a puzzle takes 5-150 ms on the smaller boards and about 0.5-1.5 s on
10×10. Codes look like `B8-…-…` (the region of each cell, then the stars).

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
7. ~~Sculpted puzzles: few clues, lots of X-Wing-type moves and hidden pairs, capped hardest moves~~
8. ~~Names and printing~~
9. ~~Treasure Map (Japanese Sums), Futoshiki, Calcudoku, Star Battle~~
10. Next: more sudoku techniques

## Licence

MIT: anyone may use, copy and change the code, as long as the licence and copyright
notice stay with it. See `LICENSE`.
