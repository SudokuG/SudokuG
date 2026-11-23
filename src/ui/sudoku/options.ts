// The sudoku Options tab: the checkbox options (titles and texts in one table), built into
// the page, wired to Settings, and filled in from them. Theme and Auto-finish are selects in page.html.

import { optionLabel } from "../option-label";
import type { OptionText } from "../option-label";
import { setAuto } from "./actions";
import { $, render } from "./render";
import { S, saveSettings } from "./state";
import type { Settings } from "./state";

type CheckboxKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

/** The options in the order they are listed. */
export const SUDOKU_OPTIONS: OptionText<CheckboxKey>[] = [
  { key: "auto", title: "Auto-candidates", text: "Show all candidates and keep them up to date as you place digits. Turning this off clears them." },
  { key: "mistakes", title: "Highlight mistakes", text: "Mark a digit red as soon as it does not match the solution." },
  { key: "tidy", title: "Remove candidates automatically", text: "Placing a digit removes it from the candidates and pairs in its row, column and box; taking the digit out again brings them back." },
  { key: "peers", title: "Highlight row and column", text: "Shade the row and column of the selected cell." },
  { key: "box", title: "Highlight box", text: "Shade the box of the selected cell." },
  { key: "same", title: "Highlight the same digit", text: "Mark digits and candidates equal to the selected cell's digit." },
  {
    key: "candShade",
    title: "Shade cells with the candidate",
    text: 'With "Highlight the same digit": also lightly shade the cells that have that digit as a candidate or pair. Off: only the candidate itself is marked.',
  },
  { key: "outline", title: "Outline the selected cells", text: "A frame around each group of selected cells (the shading stays either way)." },
  { key: "timer", title: "Show timer" },
  { key: "padCounts", title: "Show digits left on the number pad", text: "The small number on each key: how many of that digit still have to be placed." },
  {
    key: "sweep",
    title: "Sweep over the number pad",
    text: "Slide a finger (or the mouse, held down) from key to key to toggle those candidates in the selected cells in one go (pairs or colours in those modes).",
  },
  {
    key: "sweepDigit",
    title: "Sweep in digit mode",
    text: 'With "Sweep over the number pad": sweeping in Digit mode puts the keys in as candidates. Off: in Digit mode only the first key counts.',
  },
  {
    key: "numpadCands",
    title: "Keyboard number pad enters candidates",
    text: "The number pad on the right of a keyboard always enters candidates (it never overwrites a digit); the digits above the letters enter digits. Off: both work the same.",
  },
  { key: "toPlay", title: "Go to Play after making a puzzle", text: "Switch to the Play tab as soon as a new puzzle is ready." },
  {
    key: "stickyToggle",
    title: "S key stays on",
    text: "On a phone, the S key normally works only while you hold it. With this on, one tap switches it on and the next tap off.",
  },
];

/** Under the Hints heading. */
export const HINT_OPTIONS: OptionText<CheckboxKey>[] = [
  {
    key: "patterns",
    title: "Prefer patterns over triples and quads",
    text: "Hints show a fish, wing, kite, coloring or short chain before a triple, quad or long chain, when one exists.",
  },
];

const ALL = [...SUDOKU_OPTIONS, ...HINT_OPTIONS];

/** Build the option lists (#opt-list, #opt-hints) and wire each checkbox to its setting. */
export function buildOptions(): void {
  const html = (list: OptionText<CheckboxKey>[]) => list.map((o) => optionLabel(`id="opt-${o.key}"`, o.title, o.text)).join("");
  $("opt-list").innerHTML = html(SUDOKU_OPTIONS);
  $("opt-hints").innerHTML = html(HINT_OPTIONS);
  for (const { key: k } of ALL)
    $(`opt-${k}`).addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      // Auto-candidates fills in or clears the candidates itself.
      if (k === "auto") return setAuto(on);
      S.settings[k] = on;
      if (k === "stickyToggle") S.sticky = false;
      saveSettings();
      render();
    });
}

/** Tick each checkbox as its setting is. */
export function renderOptions(): void {
  for (const { key } of ALL) ($(`opt-${key}`) as HTMLInputElement).checked = S.settings[key];
}
