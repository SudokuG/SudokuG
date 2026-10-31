// The print dialog, shared by all puzzle types. A game says what it wants to print (its
// title, whether there is progress to include, whether several puzzles can be printed and
// how to gather them); the dialog asks for the layout, lays out the pages (print.ts) and
// opens the browser's print window. Choices are remembered in this browser.
//
// Ctrl+P (or the browser's own Print) prints the current puzzle of the game on screen,
// through the provider that game registers with setCurrentPrint().

import { PER_PAGE, renderPrint } from "./print";
import type { PerPage, PrintLayout, PrintPuzzle } from "./print";

const KEY = "sudokug-print";
const OLD_SETTINGS_KEY = "pattern-sudoku-settings";

export interface PrintPrefs {
  perPageOne: PerPage;
  perPageMany: PerPage;
  name: boolean;
  difficulty: boolean;
  code: boolean;
}

const DEFAULTS: PrintPrefs = { perPageOne: 1, perPageMany: 4, name: true, difficulty: true, code: true };

function loadPrefs(): PrintPrefs {
  try {
    const raw = localStorage.getItem(KEY) ?? JSON.stringify(JSON.parse(localStorage.getItem(OLD_SETTINGS_KEY) ?? "{}").print ?? {});
    const p = { ...DEFAULTS, ...JSON.parse(raw) };
    for (const k of ["perPageOne", "perPageMany"] as const) if (!PER_PAGE.includes(p[k])) p[k] = DEFAULTS[k];
    return p;
  } catch {
    return { ...DEFAULTS };
  }
}
const prefs = loadPrefs();
const savePrefs = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
};

export interface PrintRun {
  cancelled: boolean;
}

export interface PrintRequest {
  title: string;
  /** One line under the title. */
  what: string;
  /** Offer "empty puzzle" or "with what I filled in". */
  offerProgress: boolean;
  /** Ask how many puzzles (several), instead of printing one. */
  many: boolean;
  /**
   * Gather the puzzles. `msg` shows progress in the dialog; call `done` with the puzzles, or
   * with null and a message when it didn't work out. Stop when `run.cancelled` turns true.
   */
  collect(choice: { progress: boolean; count: number }, msg: (t: string) => void, done: (puzzles: PrintPuzzle[] | null, error?: string) => void, run: PrintRun): void;
}

const $ = (id: string) => document.getElementById(id)!;
let request: PrintRequest | null = null;
let run: PrintRun | null = null;
/** True while #print-root holds pages prepared here (so the Ctrl+P handler leaves them alone). */
let prepared = false;
let currentProvider: () => { puzzle: PrintPuzzle; perPage?: PerPage } | null = () => null;

/** What Ctrl+P prints for the game on screen. */
export function setCurrentPrint(provider: () => { puzzle: PrintPuzzle } | null): void {
  currentProvider = provider;
}

const layout = (): PrintLayout => ({ perPage: request?.many ? prefs.perPageMany : prefs.perPageOne, name: prefs.name, difficulty: prefs.difficulty, code: prefs.code });

function renderDialog(): void {
  const per = layout().perPage;
  $("print-per").replaceChildren(
    ...PER_PAGE.map((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(n);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(n === per));
      b.classList.toggle("on", n === per);
      b.addEventListener("click", () => {
        if (request?.many) prefs.perPageMany = n;
        else prefs.perPageOne = n;
        savePrefs();
        renderDialog();
      });
      return b;
    }),
  );
  ($("print-name") as HTMLInputElement).checked = prefs.name;
  ($("print-difficulty") as HTMLInputElement).checked = prefs.difficulty;
  ($("print-code") as HTMLInputElement).checked = prefs.code;
}

export function openPrintDialog(req: PrintRequest): void {
  request = req;
  $("print-title").textContent = req.title;
  $("print-what").textContent = req.what;
  $("print-progress").hidden = !req.offerProgress;
  ($("print-progress").querySelector('input[value="empty"]') as HTMLInputElement).checked = true;
  $("print-count-row").hidden = !req.many;
  $("print-msg").textContent = "";
  ($("print-go") as HTMLButtonElement).disabled = false;
  renderDialog();
  ($("print-dialog") as HTMLDialogElement).showModal();
}

/** Lay out the pages and open the browser's print window. */
function printNow(puzzles: PrintPuzzle[]): void {
  renderPrint($("print-root"), puzzles, layout());
  prepared = true;
  ($("print-dialog") as HTMLDialogElement).close();
  setTimeout(() => window.print(), 60);
}

function start(): void {
  if (!request) return;
  prefs.name = ($("print-name") as HTMLInputElement).checked;
  prefs.difficulty = ($("print-difficulty") as HTMLInputElement).checked;
  prefs.code = ($("print-code") as HTMLInputElement).checked;
  savePrefs();
  const progress = request.offerProgress && ($("print-progress").querySelector('input[value="progress"]') as HTMLInputElement).checked;
  const count = Math.max(1, Math.min(30, Math.round(Number(($("print-count") as HTMLInputElement).value) || 1)));
  ($("print-count") as HTMLInputElement).value = String(count);
  const r: PrintRun = { cancelled: false };
  run = r;
  ($("print-go") as HTMLButtonElement).disabled = true;
  request.collect(
    { progress, count: request.many ? count : 1 },
    (t) => ($("print-msg").textContent = t),
    (puzzles, error) => {
      if (r.cancelled) return;
      run = null;
      if (puzzles && puzzles.length) return printNow(puzzles);
      ($("print-go") as HTMLButtonElement).disabled = false;
      $("print-msg").textContent = error ?? "Nothing to print.";
    },
    r,
  );
}

function cancel(): void {
  if (run) run.cancelled = true;
  run = null;
  ($("print-dialog") as HTMLDialogElement).close();
}

export function wirePrintDialog(): void {
  $("print-go").addEventListener("click", start);
  $("print-cancel").addEventListener("click", cancel);
  $("print-dialog").addEventListener("cancel", () => {
    if (run) run.cancelled = true;
    run = null;
  });
  // Ctrl+P (or the browser menu) prints the current puzzle, not the whole page.
  window.addEventListener("beforeprint", () => {
    if (prepared) return;
    const cur = currentProvider();
    if (cur) renderPrint($("print-root"), [cur.puzzle], { ...layout(), perPage: prefs.perPageOne });
    else $("print-root").innerHTML = `<p style="font: 12pt sans-serif">Open a puzzle to print it.</p>`;
  });
  window.addEventListener("afterprint", () => {
    prepared = false;
    $("print-root").innerHTML = "";
  });
}
