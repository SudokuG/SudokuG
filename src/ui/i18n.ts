// The page's language: English (the source text), German or Dutch. The English text itself is
// the key: t("New puzzle") looks it up in the tables in src/ui/lang/ ([English, German, Dutch]
// per row) and falls back to the English. Placeholders: t("Solved in {time}.", { time }).
// Static markup (page.html, the light pages) is translated once by translateTree(), before
// the app starts; changing the language saves the choice and reloads the page.

import { HELP_TEXTS } from "./lang/texts-help";
import { UI_TEXTS } from "./lang/texts-ui";

export type Lang = "en" | "de" | "nl";
export type LangChoice = "auto" | Lang;

/** The languages offered, each named in itself. */
export const LANGS: [Lang, string][] = [
  ["en", "English"],
  ["de", "Deutsch"],
  ["nl", "Nederlands"],
];

/** Every row of the language tables: [English, German, Dutch]. */
export const TEXTS: [string, string, string][] = [...UI_TEXTS, ...HELP_TEXTS];
const column = (k: number) => Object.fromEntries(TEXTS.map((row) => [row[0], row[k]]));
const DICTS: Record<Lang, Record<string, string>> = { en: {}, de: column(1), nl: column(2) };
const KEY = "sudokug-language";

export function langChoice(): LangChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "auto" || LANGS.some(([l]) => l === v)) return v as LangChoice;
  } catch {
    /* storage unavailable */
  }
  return "auto";
}

/** "auto": the first of the device's languages that the page has, else English. */
function resolve(choice: LangChoice): Lang {
  if (choice !== "auto") return choice;
  const wanted = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language ?? ""];
  for (const w of wanted) {
    const l = w.toLowerCase().slice(0, 2);
    if (LANGS.some(([x]) => x === l)) return l as Lang;
  }
  return "en";
}

export const lang: Lang = resolve(langChoice());

/** Save the choice and load the page again in that language (the game is saved first by the page's own pagehide handler). */
export function setLangChoice(c: LangChoice): void {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* ignore */
  }
  if (resolve(c) !== lang) location.reload();
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** The text in the page's language; {name} placeholders are filled from vars. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[lang];
  const out = dict[text] ?? dict[norm(text)] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

/** True when the page shows another language than English. */
export const translated = lang !== "en";

/** A level name inside a sentence: lower case in English ("a medium puzzle"), as the dictionary has it otherwise. */
export const tLevel = (level: string) => (lang === "en" ? level.toLowerCase() : t(level));

/** A sentence's start inside another sentence: lower case in English only (German nouns keep their capital). */
export const lowerFirst = (s: string) => (lang === "en" ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * A puzzle's label ("Easy", "Daily Hard", "Imported", a sample's name) in the page's language;
 * the label itself is data (saved, used for names and stats), so it stays English.
 */
export function tLabel(label: string): string {
  const daily = /^Daily (\w+)(.*)$/.exec(label);
  return daily ? t("Daily {level}", { level: t(daily[1]) }) + daily[2] : t(label);
}

/** Elements whose whole inner HTML may be one entry (text with <b>, <kbd>, links in it). */
const WHOLE = new Set(["P", "LI", "SMALL", "LABEL", "SPAN", "H2", "H3", "SUMMARY"]);
const ATTRS = ["title", "aria-label", "placeholder"];

/**
 * Translate static markup in place: text nodes and the title, aria-label and placeholder
 * attributes that are dictionary entries, and elements whose whole inner HTML is one.
 */
export function translateTree(root: Element): void {
  if (!translated) return;
  const dict = DICTS[lang];
  const walk = (el: Element) => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && dict[norm(v)]) el.setAttribute(a, dict[norm(v)]);
    }
    if (WHOLE.has(el.tagName) && el.children.length) {
      const html = dict[norm(el.innerHTML)];
      if (html) return void (el.innerHTML = html);
    }
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 3) {
        const raw = n.textContent ?? "";
        const s = norm(raw);
        if (s && dict[s]) n.textContent = raw.match(/^\s*/)![0] + dict[s] + raw.match(/\s*$/)![0];
      } else if (n.nodeType === 1) walk(n as Element);
    }
  };
  walk(root);
}

/** The Language choice in an Options tab (both pages): "Same as my device" or one of LANGS. */
export const langSelectHtml = (id: string) =>
  `<div class="opt-select"><label for="${id}"><b>${t("Language")}</b></label><select id="${id}" data-lang-select><option value="auto">${t("Same as my device")}</option>${LANGS.map(([l, name]) => `<option value="${l}">${name}</option>`).join("")}</select></div>`;

/** Wire every Language choice on the page; the page also says which language it is in. */
export function initLanguage(): void {
  document.documentElement.lang = lang;
  // Browsers' own page translation garbles the page (and hides buttons): the page translates itself.
  document.documentElement.setAttribute("translate", "no");
  document.querySelectorAll<HTMLSelectElement>("select[data-lang-select]").forEach((sel) => {
    sel.value = langChoice();
    sel.addEventListener("change", () => {
      document.querySelectorAll<HTMLSelectElement>("select[data-lang-select]").forEach((x) => (x.value = sel.value));
      setLangChoice(sel.value as LangChoice);
    });
  });
}
