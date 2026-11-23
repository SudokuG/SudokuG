// User interface. All sudoku logic lives in ../engine; this file only renders
// the state and turns clicks and keys into state changes.
// The parts of the sudoku page are in ./sudoku/ (state, puzzles, finish, generate, printing,
// actions, pad, render); this file has the theme, tabs, keys and the wiring (init).

import { DIFFICULTIES, Grid, TEMPLATES, colOf, rowOf } from "../engine";
import { CALCUDOKU } from "../games/calcudoku/game";
import { FUTOSHIKI } from "../games/futoshiki/game";
import { initLite } from "../games/lite";
import { initLanguage, langSelectHtml, lowerFirst, t, translateTree } from "./i18n";
import { STAR_BATTLE } from "../games/starbattle/game";
import { TREASURE_MAP } from "../games/sums/game";
import { SAMPLES } from "../samples";
import { PALETTES } from "./board";
import { currentGame, initGamePicker } from "./games";
import { initGuide, moveGuide } from "./guide-view";
import { toggleLike } from "./likes";
import { resetStats } from "./stats";
import { applyHint, check, clearCandidates, clearColorsOfSelection, doRedo, doUndo, enterNumber, erase, fillCandidates, select, showHint } from "./sudoku/actions";
import { nextProfile, openDaily, renderDaily, renderLikeButton, renderLikes, renderStats } from "./sudoku/finish";
import { buildTechniqueToggles, cancelGenerate, renderGen, setProfile, startGenerate } from "./sudoku/generate";
import { buildOptions } from "./sudoku/options";
import { buildPad, wireEraseButton } from "./sudoku/pad";
import { wirePrinting } from "./sudoku/printing";
import { clearPuzzle, loadPuzzle, noPuzzle, openPuzzle, parsePuzzle, restoreGame, saveGame, startTimer } from "./sudoku/puzzles";
import { $, buildBoard, render, renderModes, setMode, setTab } from "./sudoku/render";
import { MODES, MODE_KEYS, S, TABS, effectiveMode, saveSettings } from "./sudoku/state";
import type { Mode, Settings } from "./sudoku/state";

// Theme

const hostTheme = document.documentElement.getAttribute("data-theme");
function applyTheme(): void {
  const t = S.settings.theme;
  const root = document.documentElement;
  if (t !== "system") root.setAttribute("data-theme", t);
  else if (hostTheme) root.setAttribute("data-theme", hostTheme);
  else root.removeAttribute("data-theme");
}

// Wiring

function move(dr: number, dc: number, extend: boolean): void {
  const r = (rowOf(S.primary) + dr + 9) % 9;
  const c = (colOf(S.primary) + dc + 9) % 9;
  select(r * 9 + c, extend);
  render();
}

function onKey(e: KeyboardEvent): void {
  if (currentGame() !== "sudoku") return;
  const t = e.target as HTMLElement;
  if (e.key === "Shift" && !S.shift) {
    S.shift = true;
    renderModes();
  }
  if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT") return;
  const k = e.key;
  const ctrl = e.ctrlKey || e.metaKey;

  if (S.tab === "techniques") {
    if (k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      moveGuide(k === "ArrowUp" ? -1 : 1);
    }
    return;
  }

  if (ctrl && (k === "z" || k === "Z")) {
    e.preventDefault();
    return e.shiftKey ? doRedo() : doUndo();
  }
  if (ctrl && (k === "y" || k === "Y")) {
    e.preventDefault();
    return doRedo();
  }
  if (ctrl || e.altKey) return;

  // Shift+digit gives "!" etc. on many layouts, so read the physical key too.
  // On Windows, Shift+numpad digit arrives without shiftKey but as "End", "ArrowDown", ...
  const codeDigit = /^(Digit|Numpad)([1-9])$/.exec(e.code);
  if (codeDigit || /^[1-9]$/.test(k)) {
    e.preventDefault();
    const d = codeDigit ? Number(codeDigit[2]) : Number(k);
    const numpad = !!codeDigit && codeDigit[1] === "Numpad";
    const numpadShift = numpad && !/^[1-9]$/.test(k);
    // With "number pad enters candidates", the number pad works like a held Shift.
    return enterNumber(d, effectiveMode(e.shiftKey || numpadShift || (numpad && S.settings.numpadCands)));
  }
  const lower = k.toLowerCase();
  if (MODE_KEYS[lower]) return setMode(MODE_KEYS[lower]);
  switch (k) {
    case "ArrowUp": e.preventDefault(); return move(-1, 0, e.shiftKey);
    case "ArrowDown": e.preventDefault(); return move(1, 0, e.shiftKey);
    case "ArrowLeft": e.preventDefault(); return move(0, -1, e.shiftKey);
    case "ArrowRight": e.preventDefault(); return move(0, 1, e.shiftKey);
    case "0":
      e.preventDefault();
      return S.mode === "color" ? clearColorsOfSelection() : erase();
    case "Backspace": case "Delete": e.preventDefault(); return erase();
    case " ":
      if (t.tagName === "BUTTON" || t.tagName === "SUMMARY") return;
      e.preventDefault();
      return setMode(MODES[(MODES.indexOf(S.mode) + 1) % MODES.length]);
    case "h": case "H": return showHint();
    case "Escape":
      if (S.hint) S.hint = null;
      else select(S.primary, false);
      return render();
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === "Shift" && S.shift) {
    S.shift = false;
    renderModes();
  }
}

function copyText(text: string, msgEl: HTMLElement, selectEl?: HTMLElement): void {
  const fallback = () => {
    if (selectEl) {
      const range = document.createRange();
      range.selectNodeContents(selectEl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      msgEl.textContent = t("Code selected; press Ctrl+C (or Cmd+C) to copy.");
      return;
    }
    const ta = $("import") as HTMLTextAreaElement;
    ta.value = text;
    ta.focus();
    ta.select();
    msgEl.textContent = t("Selected in the box above; press Ctrl+C (or Cmd+C) to copy.");
  };
  try {
    navigator.clipboard.writeText(text).then(() => (msgEl.textContent = t("Copied to the clipboard.")), fallback);
  } catch {
    fallback();
  }
}

function init(): void {
  $("lang-pick").outerHTML = langSelectHtml("opt-lang");
  translateTree(document.body);
  applyTheme();
  buildBoard();
  buildPad();
  initGuide();
  wirePrinting();

  const samples = $("samples");
  for (const s of SAMPLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.puzzle = s.puzzle;
    b.title = t(s.note);
    b.textContent = t(s.name);
    b.addEventListener("click", () => {
      openPuzzle(s.puzzle, s.name);
      $("puzzle-msg").textContent = t("Loaded “{name}”: {note}.", { name: t(s.name), note: lowerFirst(t(s.note)) });
    });
    samples.appendChild(b);
  }

  for (const name of TABS) $(`tab-${name}`).addEventListener("click", () => setTab(name));
  document.querySelectorAll<HTMLButtonElement>("#modes .mode-btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode as Mode)));
  $("undo").addEventListener("click", doUndo);
  $("redo").addEventListener("click", doRedo);
  wireEraseButton();
  $("palette").addEventListener("click", () => {
    S.palette = (S.palette + 1) % PALETTES;
    render();
  });
  $("eye").addEventListener("click", () => {
    S.colorHidden[S.palette] = !S.colorHidden[S.palette];
    render();
  });
  $("hint").addEventListener("click", showHint);
  $("hint-more").addEventListener("click", showHint);
  $("hint-apply").addEventListener("click", applyHint);
  $("hint-close").addEventListener("click", () => {
    S.hint = null;
    S.flash.clear();
    render();
  });
  $("check").addEventListener("click", check);
  $("fill-cands").addEventListener("click", fillCandidates);
  $("clear-cands").addEventListener("click", clearCandidates);

  $("opt-theme").addEventListener("change", (e) => {
    S.settings.theme = (e.target as HTMLSelectElement).value as Settings["theme"];
    saveSettings();
    applyTheme();
  });
  $("opt-finish").addEventListener("change", (e) => {
    S.settings.autoFinish = Number((e.target as HTMLSelectElement).value);
    saveSettings();
  });
  buildOptions();

  $("load").addEventListener("click", () => {
    const text = ($("import") as HTMLTextAreaElement).value;
    const err = openPuzzle(text, "Imported");
    if (!err) setTab("play");
    $("puzzle-msg").textContent = err ?? t("Puzzle loaded.");
  });
  $("copy").addEventListener("click", () => copyText(S.puzzle, $("puzzle-msg")));
  document.querySelectorAll<HTMLElement>(".copy-code").forEach((b) =>
    b.addEventListener("click", () => copyText(S.code, $("status"), b.parentElement!.querySelector<HTMLElement>(".puzzle-code")!)),
  );
  // On the website (not inside a frame), offer a link that opens this exact puzzle.
  const onWebsite = /^https?:$/.test(location.protocol) && window.self === window.top;
  document.querySelectorAll<HTMLElement>(".copy-link").forEach((b) => {
    b.hidden = !onWebsite;
    b.addEventListener("click", () => copyText(`${location.origin}${location.pathname}#${S.code}`, $("status")));
  });

  const pick = $("diff-pick");
  for (const d of DIFFICULTIES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.d = d;
    b.textContent = t(d);
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => setProfile(TEMPLATES[d]));
    pick.appendChild(b);
  }
  buildTechniqueToggles();

  const daily = $("daily-pick");
  for (const d of DIFFICULTIES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.d = d;
    b.addEventListener("click", () => openDaily(d));
    daily.appendChild(b);
  }
  // At midnight the daily puzzles change: refresh the list now and then.
  setInterval(renderDaily, 60000);
  renderDaily();
  renderStats();
  $("stats-reset").addEventListener("click", () => ($("stats-reset-yes").hidden = false));
  $("stats-reset-yes").addEventListener("click", () => {
    resetStats();
    $("stats-reset-yes").hidden = true;
    renderStats();
    renderDaily();
  });
  $("solved-new").addEventListener("click", () => {
    const next = nextProfile();
    if (!next) return;
    if (next !== "Custom") setProfile(TEMPLATES[next as keyof typeof TEMPLATES]);
    startGenerate();
    setTab("puzzles");
  });
  $("solved-pick").addEventListener("click", () => setTab("puzzles"));
  $("solved-like").addEventListener("click", () => {
    if (!S.puzzle) return;
    const label = S.daily
      ? `Daily ${S.daily.difficulty}, ${new Date(`${S.daily.date}T12:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" })}`
      : S.label;
    toggleLike(S.puzzle, { code: S.code, label, time: S.solved ? S.elapsed : null });
    renderLikeButton();
    renderLikes();
  });
  renderLikes();
  $("generate").addEventListener("click", () => startGenerate());
  $("gen-cancel").addEventListener("click", cancelGenerate);
  $("restart").addEventListener("click", () => {
    if (noPuzzle()) return;
    const meta = { daily: S.daily, author: S.author };
    loadPuzzle(S.puzzle, S.label);
    S.daily = meta.daily;
    S.author = meta.author;
    render();
    saveGame();
    $("puzzle-msg").textContent = t("Restarted.");
  });
  // A long press on a button opens no context menu (it would get in the way of holding).
  document.addEventListener("contextmenu", (e) => {
    if ((e.target as HTMLElement).closest?.("button")) e.preventDefault();
  });
  // A button tapped on a touch screen lets go of the focus, so no focus ring lingers on it
  // (the focus comes with the click, after the finger lifts).
  let touched = false;
  document.addEventListener("pointerdown", (e) => (touched = e.pointerType !== "mouse"), { capture: true });
  document.addEventListener("keydown", () => (touched = false), { capture: true });
  const letGo = () => {
    const a = document.activeElement;
    if (touched && a instanceof HTMLButtonElement) a.blur();
  };
  document.addEventListener("click", letGo);
  document.addEventListener("focusin", () => touched && setTimeout(letGo));
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    if (!S.shift) return;
    S.shift = false;
    renderModes();
  });

  startTimer();
  // Save when the page is hidden or closed, and now and then while playing (for the timer).
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveGame());
  window.addEventListener("pagehide", saveGame);
  setInterval(saveGame, 15000);
  watchForUpdates();

  renderGen();
  // Opening order: a shared puzzle link, else the saved game, else an empty grid.
  const shared = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : "";
  let sharedPuzzle = "";
  try {
    sharedPuzzle = shared ? new Grid(parsePuzzle(shared)).toString() : "";
  } catch {
    sharedPuzzle = "";
  }
  if (sharedPuzzle) {
    // Opening the same link again continues the saved progress on that puzzle.
    openPuzzle(sharedPuzzle, "Shared");
    setTab("play");
  } else if (restoreGame()) {
    setTab("play");
  } else {
    clearPuzzle();
    setTab("puzzles");
  }
  // The other puzzle types (a link to one of them switches to it).
  // They share the site-wide theme, which lives with the sudoku settings.
  const theme = {
    get: () => S.settings.theme,
    set: (t: string) => {
      S.settings.theme = t as Settings["theme"];
      saveSettings();
      applyTheme();
      render();
    },
  };
  initLite(TREASURE_MAP, $("game-sums"), theme);
  initLite(FUTOSHIKI, $("game-futoshiki"), theme);
  initLite(CALCUDOKU, $("game-calcudoku"), theme);
  initLite(STAR_BATTLE, $("game-starbattle"), theme);
  // The puzzle-type dropdowns (one in each Puzzles tab), now that every page is built.
  initGamePicker();
  initLanguage();
}

/**
 * Updates: the service worker fetches a new version in the background. The game keeps
 * running the version it started with; a small notice offers to switch. The game is
 * saved, so switching (or simply opening the site later) continues where you were.
 */
function watchForUpdates(): void {
  if (!("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) $("update-toast").hidden = false;
  });
  $("update-reload").addEventListener("click", () => {
    saveGame();
    location.reload();
  });
  $("update-later").addEventListener("click", () => ($("update-toast").hidden = true));
}

init();
