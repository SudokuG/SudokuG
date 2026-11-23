// One option in an Options tab: a checkbox with its title and, below it, what it does.
// Shared by the sudoku page (sudoku/options.ts) and the light page (games/lite/options.ts).

import { t } from "./i18n";

/** An option's text: the setting it switches, its title, and what it does (optional). */
export interface OptionText<K extends string> {
  key: K;
  title: string;
  text?: string;
}

/** The label of one option; attr is the checkbox's attribute that names it (id="opt-…" or data-opt="…"). */
export const optionLabel = (attr: string, title: string, text?: string): string =>
  `<label class="opt"><input ${attr} type="checkbox"> <span><b>${t(title)}</b>${text ? `<small>${t(text)}</small>` : ""}</span></label>`;
