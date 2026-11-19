// The HTML of the light puzzle page (built once per type), the grid lines, candidate pills,
// and small text helpers.

import { RING } from "../logic";
import { AUTO_FINISH_CHOICES, LITE_OPTION_TEXT } from "./options";
import type { LiteGame, LitePuzzle, Tab } from "./types";

export const TABS: [Tab, string][] = [
  ["play", "Play"],
  ["puzzles", "Puzzles"],
  ["options", "Options"],
  ["techniques", "Techniques"],
];

export const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * Candidates as a small framed pill (in the colour of entered digits); an empty ring for
 * "a digit goes here". `gone` (full hints, examples) strikes candidates that are ruled out.
 */
export function pillHtml(cands: number, max: number, gone = 0, hl = 0): string {
  if (!cands) return "";
  // An empty ring: the same pill as one candidate, with the digit left invisible.
  if (cands === RING) return `<span class="lite-pill ring"><span class="ghost">0</span></span>`;
  const ds = Array.from({ length: max + 1 }, (_, k) => k).filter((d) => cands & (1 << d));
  const cls = (d: number) => (gone & (1 << d) ? ' class="gone"' : hl && d === hl ? ' class="hl"' : "");
  const inner = ds.map((d) => `<span${cls(d)}>${d ? d : "✕"}</span>`).join("");
  return `<span class="lite-pill${ds.length > 3 ? " many" : ""}">${inner}</span>`;
}

export const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The grid lines of an n×n board as SVG (100 units per cell): thin lines between cells of a
 * region, thick ones between regions and around the board. Thick lines are joined into runs
 * and drawn with square caps over the thin ones, so corners close cleanly.
 */
export function linesHtml(n: number, regionOf: number[]): string {
  const thin: string[] = [];
  const thick: string[] = [];
  // Horizontal lines y = 0..n: thick at the edge or between two regions.
  for (let y = 0; y <= n; y++) {
    let run = -1;
    for (let x = 0; x <= n; x++) {
      const isThick = x < n && (y === 0 || y === n || regionOf[(y - 1) * n + x] !== regionOf[y * n + x]);
      if (x < n && !isThick) thin.push(`M${x * 100} ${y * 100}h100`);
      if (isThick && run < 0) run = x;
      if (!isThick && run >= 0) (thick.push(`M${run * 100} ${y * 100}H${x * 100}`), (run = -1));
    }
  }
  for (let x = 0; x <= n; x++) {
    let run = -1;
    for (let y = 0; y <= n; y++) {
      const isThick = y < n && (x === 0 || x === n || regionOf[y * n + x - 1] !== regionOf[y * n + x]);
      if (y < n && !isThick) thin.push(`M${x * 100} ${y * 100}v100`);
      if (isThick && run < 0) run = y;
      if (!isThick && run >= 0) (thick.push(`M${x * 100} ${run * 100}V${y * 100}`), (run = -1));
    }
  }
  return `<path class="thin" d="${thin.join("")}"/><path class="thick" d="${thick.join("")}"/>`;
}

/** The rules and the controls, for the Rules entry of the Techniques tab. */
export function rulesHtml<P extends LitePuzzle>(g: LiteGame<P>): string {
  const controls =
    g.controls ??
    `<li>Tap or click a cell; drag over cells to select them all. On a phone, hold <b>S</b> and tap or drag to add more cells (the selection and its digit highlight stay); tap a selected cell again to drop it; while S is held, digits go in as candidates. On a computer, <kbd>Shift</kbd> adds cells and <kbd>Ctrl</kbd> toggles them. Tap outside the grid to select nothing.</li>
      <li>Slide a finger over the pad keys to toggle several candidates at once. A key with nothing selected marks every cell with that digit or candidate.</li>
      <li>Digits enter digits; with <kbd>Shift</kbd>, <b>S</b> or Candidates on, they toggle small candidates in the middle of the cell. The number pad can always enter candidates (an option).${g.xPerLine ? " <kbd>X</kbd> or <kbd>0</kbd> places an X (or right-click the cell; drag with the right button held to X every open cell you pass, or start on an X to take them away); <kbd>.</kbd> or <kbd>O</kbd> an empty ring (a digit goes here); hold the ring key or <kbd>O</kbd> for 2 seconds to clear all rings. Candidates without ✕ also mean “not an X”; add ✕ to them while it still might be one." : ""}</li>
      <li><kbd>H</kbd> hint, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Backspace</kbd> erase, <kbd>Space</kbd> switches candidates on or off, arrow keys move.</li>`;
  return `${g.rules}
    <h3>Mouse, keyboard and touch</h3>
    <ul class="keys small">
      ${controls}
    </ul>`;
}

export function markup<P extends LitePuzzle>(g: LiteGame<P>, theme: boolean): string {
  const id = g.id;
  const codeRow = (cls: string) => `
    <div class="code-row ${cls}">
      <span class="code-label">Puzzle code</span>
      <code data-r="code" class="puzzle-code"></code>
      <button data-r="copy" class="link-btn" type="button">Copy link</button>
      <button data-r="print" class="link-btn" type="button">Print</button>
    </div>`;
  const word = g.regionWord ?? "region";
  const forType = (o: (typeof LITE_OPTION_TEXT)[number]) =>
    o.for === "candidates" ? g.candidates !== false : o.for === "autoDots" ? !!g.autoMarks : o.for === "smart" ? !!g.smartInput : o.for === "regions" ? !!g.regions : true;
  const options = LITE_OPTION_TEXT.filter(forType).map(
    (o) => `<label class="opt"><input data-opt="${o.key}" type="checkbox"> <span><b>${o.title.replace("region", word)}</b>${o.text ? `<small>${o.text.replace("region", word)}</small>` : ""}</span></label>`,
  ).join("");
  return `
    <section class="lite-board-wrap">
      <div data-r="guide" class="lite-guide" hidden>
        <h2 data-r="guide-title" class="guide-title"></h2>
        <div data-r="guide-rules" class="rules guide-text" hidden></div>
        <div data-r="guide-example" hidden>
          <div data-r="guide-board" class="lite-board static ${g.id}-board" aria-hidden="true"></div>
          <div class="guide-text">
            <h3>The idea</h3>
            <p data-r="guide-idea"></p>
            <h3 data-r="guide-why-h">Why it works</h3>
            <p data-r="guide-why"></p>
            <h3>How to spot it</h3>
            <p data-r="guide-spot"></p>
            <h3>In this example</h3>
            <p data-r="guide-step"></p>
            <p class="legend small"><span class="key k-region"></span>where to look <span class="key k-put"></span>what follows <span class="key k-gone"></span>ruled out</p>
          </div>
        </div>
      </div>
      <div class="lite-head">
        <span data-r="name" class="puzzle-name"></span>
        <span data-r="label" class="puzzle-label"></span>
        <span data-r="timer" class="timer" aria-label="Time">0:00</span>
      </div>
      <div data-r="board" class="lite-board ${id}-board" role="grid" tabindex="0" aria-label="${esc(g.title)} grid. Arrow keys move, ${g.candidates === false ? "1 places a star, 0 or X an empty cell" : `digits enter${g.xPerLine ? ", X places an X, O a ring" : ""}`}."></div>
      ${codeRow("code-row-desktop")}
      <p data-r="status" class="status" aria-live="polite"></p>
    </section>
    <aside class="panel lite-panel">
      <nav class="tabs" role="tablist" aria-label="Panel">
        ${TABS.map(([t, label]) => `<button data-tab="${t}" class="tab" type="button" role="tab">${label}</button>`).join("")}
      </nav>
      <div data-pane="play" class="pane" role="tabpanel">
        <div data-r="solved" class="solved-card" hidden>
          <div class="solved-head"><span class="solved-title">Solved</span><span data-r="solved-time" class="solved-time"></span></div>
          <p data-r="solved-text" class="small"></p>
          <div class="hint-actions"><button data-r="solved-new" class="btn primary" type="button">New puzzle</button></div>
        </div>
        <div data-r="hint-card" class="hint-card" hidden>
          <div class="hint-head">
            <span data-r="hint-tech" class="hint-tech"></span>
            <button data-r="hint-close" class="icon-btn" type="button" aria-label="Close hint">×</button>
          </div>
          <p data-r="hint-text" class="hint-text"></p>
          <div class="hint-actions">
            <button data-r="hint-more" class="btn" type="button">Show the move</button>
            <button data-r="hint-apply" class="btn primary" type="button">Apply</button>
          </div>
        </div>
        <div data-r="pad" class="pad lite-pad" aria-label="Number pad"></div>
        <div class="actions act-edit">
          <button data-r="undo" class="btn" type="button" title="Undo (Ctrl+Z)">Undo</button>
          <button data-r="redo" class="btn" type="button" title="Redo (Ctrl+Y)">Redo</button>
          <button data-r="erase" class="btn" type="button" title="Erase (Backspace)">Erase</button>
          ${g.candidates === false ? "" : `<button data-r="mode" class="btn lite-mode" type="button" aria-pressed="false" title="Candidates (Space, or hold Shift)">Candidates</button>`}
        </div>
        <div class="actions act-hint">
          <button data-r="hint" class="btn primary wide" type="button" title="Hint (H)">Hint</button>
          <button data-r="check" class="btn" type="button">Check</button>
          <button data-r="reveal" class="btn" type="button" title="Fill in the selected cell">Reveal</button>
        </div>
        ${g.notes ? `<section data-r="notes" class="lite-notes" aria-label="Notes"><h2 class="pane-title notes-title">Notes</h2><div data-r="note-list" class="note-list"></div></section>` : ""}
      </div>
      <div data-pane="puzzles" class="pane" role="tabpanel" hidden>
        <div class="type-pick" data-type-pick></div>
        <h2 class="pane-title">New ${esc(g.noun)}</h2>
        <span class="small-label">Size</span>
        <div data-r="sizes" class="diff-pick lite-sizes" role="radiogroup" aria-label="Size"></div>
        <span class="small-label">Difficulty</span>
        <div data-r="levels" class="diff-pick lite-levels" role="radiogroup" aria-label="Difficulty"></div>
        <div class="row">
          <button data-r="new" class="btn primary" type="button">New puzzle</button>
          <button data-r="restart" class="btn" type="button">Restart</button>
        </div>
        <div class="print-row">
          <button data-r="print-many" class="link-btn" type="button">Print puzzles</button>
          <span class="small">to solve on paper, or save them as a PDF</span>
        </div>
        <h2 class="pane-title">Load a puzzle</h2>
        <label for="${id}-import" class="small-label">Paste a ${esc(g.title)} code (it looks like ${esc(g.codeHint)})</label>
        <div class="row"><input id="${id}-import" data-r="import" class="code-input" type="text" spellcheck="false" placeholder="${esc(g.codeHint)}"><button data-r="load" class="btn" type="button">Load</button></div>
        <p data-r="load-msg" class="small"></p>
        <details class="info">
          <summary>Your stats</summary>
          <div data-r="stats" class="stats"></div>
        </details>
      </div>
      <div data-pane="options" class="pane" role="tabpanel" hidden>
        ${theme ? `<div class="opt-select"><label for="${id}-theme"><b>Theme</b></label><select id="${id}-theme" data-r="theme"><option value="system">Same as my device</option><option value="light">Light</option><option value="dark">Dark</option></select></div>` : ""}
        <div class="options">${options}</div>
        <div class="opt-select">
          <label for="${id}-finish"><b>Auto-finish</b></label>
          <select id="${id}-finish" data-r="finish">${AUTO_FINISH_CHOICES.map((k) => `<option value="${k}">${k ? `Last ${k} cells` : "Off"}</option>`).join("")}</select>
          <small>When only this many cells are left, everything you filled in is right, and the rest follows from singles, the puzzle fills itself in.</small>
        </div>
        <p class="small">These options are for ${esc(g.title)} only; each puzzle type keeps its own.</p>
      </div>
      <div data-pane="techniques" class="pane" role="tabpanel" hidden>
        <div data-r="guide-list" class="guide-list" role="tablist" aria-orientation="vertical" aria-label="Techniques"></div>
      </div>
    </aside>
    ${codeRow("code-row-mobile")}`;
}
