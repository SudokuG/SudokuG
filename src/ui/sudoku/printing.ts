// Printing the sudoku (the dialog is ui/print-dialog.ts, the layout ui/print.ts).

import { Grid, encodePuzzle } from "../../engine";
import { puzzleName } from "../../names";
import { currentGame, onGameChange } from "../games";
import { markPlayed } from "../played";
import type { PrintPuzzle } from "../print";
import { openPrintDialog, setCurrentPrint, wirePrintDialog } from "../print-dialog";
import { MAKE_MS, findPuzzle, profileName } from "./generate";
import { currentName, noPuzzle } from "./puzzles";
import { $ } from "./render";
import { S, shownCands } from "./state";


/** Whether the player has written anything in the current puzzle. */
export function hasProgress(): boolean {
  const { values, pencil, removed, centre, colors } = S.cur;
  return values.some((v, i) => v && !S.givens[i]) || centre.some(Boolean) || colors.some(Boolean) || (S.settings.auto ? removed.some(Boolean) : pencil.some(Boolean));
}

/** The current puzzle for printing, empty or with progress. */
export function currentPrintPuzzle(progress: boolean): PrintPuzzle {
  const givens = S.cur.values.map((v, i) => (S.givens[i] ? v : 0));
  const p: PrintPuzzle = { givens, name: currentName(), difficulty: S.label, code: S.code };
  if (progress) {
    p.values = S.cur.values.slice();
    p.cands = S.cur.values.map((_, i) => shownCands(i));
    p.centre = S.cur.centre.slice();
    p.colors = S.cur.colors.map((m) => m & ~S.colorHidden.reduce((h, hidden, k) => (hidden ? h | (511 << (k * 9)) : h), 0));
  }
  return p;
}

export function openPrint(kind: "current" | "batch"): void {
  if (kind === "current") {
    if (noPuzzle()) return;
    return openPrintDialog({
      title: "Print this puzzle",
      what: `${currentName()} · ${S.label}`,
      offerProgress: hasProgress(),
      many: false,
      collect: (choice, _msg, done) => done([currentPrintPuzzle(choice.progress)]),
    });
  }
  const label = profileName();
  const profile = S.settings.genProfile.slice();
  openPrintDialog({
    title: `Print ${label.toLowerCase()} puzzles`,
    what: `Puzzles you haven't played yet, from the library first; new ones are made when needed (about ${MAKE_MS / 1000} seconds each). Printed puzzles count as played, so Generate won't hand them out again.`,
    offerProgress: false,
    many: true,
    collect: (choice, msg, done, run) => {
      const out: PrintPuzzle[] = [];
      const taken = new Set<string>();
      const next = () => {
        if (run.cancelled) return;
        if (out.length === choice.count) {
          for (const p of out) markPlayed(p.code!);
          return done(out);
        }
        const head = `Gathering puzzles: ${out.length + 1} of ${choice.count}`;
        msg(`${head}…`);
        findPuzzle(profile, label, false, taken, run, (m) => msg(`${head}. ${m}`), (f) => {
          if (!f) {
            if (out.length) {
              for (const p of out) markPlayed(p.code!);
              return done(out);
            }
            return done(null, "No puzzle found for this mix of techniques; try ticking a few more.");
          }
          const givens = Grid.fromString(f.puzzle).values;
          const code = encodePuzzle(givens);
          taken.add(code);
          out.push({ givens, code, name: puzzleName(Grid.fromString(f.puzzle).toString(), label), difficulty: label });
          setTimeout(next, 0);
        });
      };
      next();
    },
  });
}

export function wirePrinting(): void {
  document.querySelectorAll<HTMLButtonElement>(".print-current").forEach((b) => b.addEventListener("click", () => openPrint("current")));
  $("print-batch").addEventListener("click", () => openPrint("batch"));
  wirePrintDialog();
  if (currentGame() === "sudoku") setCurrentPrint(sudokuPrint);
  onGameChange((g) => g === "sudoku" && setCurrentPrint(sudokuPrint));
}
export const sudokuPrint = () => (S.puzzle ? { puzzle: currentPrintPuzzle(false) } : null);
