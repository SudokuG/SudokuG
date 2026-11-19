// Generating: library first, then the generator; the technique toggles; the rating card.

import { ALWAYS_ON, Grid, TECHNIQUES, decodePuzzle, generateRated, groupOf, hardestGroup, ratePuzzle, templateOf } from "../../engine";
import type { Generated, ShapeSummary } from "../../engine";
import { findForProfile, pickFromLibrary } from "../../library";
import { today } from "../daily";
import { playedSet } from "../played";
import { currentName, loadPuzzle } from "./puzzles";
import { $, setTab } from "./render";
import { DIFF_DESC, MAX_ALT, MAX_TRIES, S, saveSettings } from "./state";


export let genRun: Run | null = null;

/** Name for the current profile: a template name, or "Custom". */
export const profileName = () => templateOf(S.settings.genProfile) ?? "Custom";

/** "6 X-Wing-type moves, 2 hidden pairs and 1 expert move" */
export function movesText(m: ShapeSummary): string {
  const parts: string[] = [];
  if (m.hard) parts.push(`${m.hard} X-Wing-type move${m.hard === 1 ? "" : "s"}`);
  if (m.hiddenPairs) parts.push(`${m.hiddenPairs} hidden pair${m.hiddenPairs === 1 ? "" : "s"}`);
  if (m.expert) parts.push(`${m.expert} expert move${m.expert === 1 ? "" : "s"}`);
  if (m.extreme) parts.push(`${m.extreme} extreme move${m.extreme === 1 ? "" : "s"}`);
  if (!parts.length) return "";
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
}

/** Message under Generate, optionally with a "make a brand-new one" link. */
export function genMessage(text: string, offerFresh = false): void {
  const el = $("gen-msg");
  el.textContent = text;
  if (!offerFresh) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "link-btn";
  b.textContent = "Make a brand-new one instead";
  b.addEventListener("click", () => startGenerate(true));
  el.append(" ", b);
}

/** A search that runs in small slices so the page stays responsive; `cancelled` stops it. */
export interface Run {
  cancelled: boolean;
}

/** Step a generator in ~30 ms slices; `tick` sees each yielded value, `done` the result. */
export function runSliced<Y, R>(it: Generator<Y, R>, run: Run, tick: (y: Y) => void, done: (r: R) => void): void {
  const step = () => {
    if (run.cancelled) return;
    const t0 = performance.now();
    let r = it.next();
    while (!r.done && performance.now() - t0 < 30) r = it.next();
    if (r.done) return done(r.value);
    tick(r.value);
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

/** How long the page spends making one new puzzle before it takes the best one found. */
export const MAKE_MS = 5000;

export interface Found {
  /** 81 characters. */
  puzzle: string;
  /** Set when the generator made it (skips the solution search and rating). */
  known?: Generated;
  /** What to tell the player about it. */
  note: string;
}

/**
 * One puzzle for a profile: an unplayed one from the pool (library, missed dailies; for a
 * custom mix, any pool puzzle that fits), or with `fresh` (or none left) a new one.
 * `skip` holds codes already taken (when printing several).
 */
export function findPuzzle(profile: string[], label: string, fresh: boolean, skip: Set<string>, run: Run, progress: (msg: string) => void, done: (f: Found | null) => void): void {
  const played = new Set([...playedSet(), ...skip]);
  const make = () => {
    const it = generateRated({ allowed: profile, timeBudgetMs: MAKE_MS, maxAttempts: MAX_TRIES });
    progress("Making a new puzzle…");
    runSliced(
      it,
      run,
      (p) => progress(p.candidates ? `Making a new puzzle: shaping it${Number.isFinite(p.missing) && p.missing > 0 ? ` (${p.missing} pattern move${p.missing === 1 ? "" : "s"} to go)` : ""}…` : `Making a new puzzle… ${p.attempts} tried so far.`),
      (g) => {
        if (!g) return done(null);
        const moves = movesText(g.shape);
        const what = `New ${label.toLowerCase()} puzzle${moves ? ` with ${moves}` : ""}`;
        done({
          puzzle: g.puzzle.join(""),
          known: g,
          note: g.missing ? `${what}: the best one found in ${MAKE_MS / 1000} seconds, ${g.missing} short of the usual recipe.` : `${what}.`,
        });
      },
    );
  };
  if (fresh) return make();
  if (label !== "Custom") {
    const pick = pickFromLibrary(label, played, today());
    if (!pick) return make();
    const liked = pick.likes ? ` Liked by ${pick.likes} player${pick.likes === 1 ? "" : "s"}.` : "";
    const an = /^[AEIOU]/.test(label) ? "An" : "A";
    const from = pick.source === "daily" ? "a daily puzzle you missed" : `${an.toLowerCase()} ${label.toLowerCase()} puzzle from the library`;
    const left = pick.left ? `${pick.left} more you haven't played.` : "That was the last one you hadn't played; next time a new one is made.";
    return done({ puzzle: Grid.fromString(decodePuzzle(pick.code).join("")).toString(), note: `${from[0].toUpperCase()}${from.slice(1)}.${liked} ${left}` });
  }
  progress("Looking through the puzzle library for one that fits your mix…");
  runSliced(
    findForProfile(profile, played, today()),
    run,
    () => {},
    (code) => {
      if (!code) return make();
      done({ puzzle: Grid.fromString(decodePuzzle(code).join("")).toString(), note: "A puzzle from the library that fits your mix of techniques." });
    },
  );
}

/**
 * "Generate": first an unplayed puzzle from the pool (instant for a template, a short search
 * for a custom mix); otherwise, or with `fresh`, a new one, made in up to about 5 seconds.
 */
export function startGenerate(fresh = false): void {
  if (genRun) return;
  const label = profileName();
  const run: Run = { cancelled: false };
  genRun = run;
  genMessage("Looking for a puzzle…");
  renderGen();
  findPuzzle(S.settings.genProfile, label, fresh, new Set(), run, (msg) => genMessage(msg), (f) => {
    genRun = null;
    renderGen();
    if (!f) return genMessage(`No puzzle found in ${MAX_TRIES} tries. This mix of techniques is rare on its own; try ticking a few more.`);
    loadPuzzle(f.puzzle, label, f.known);
    genMessage(f.note, !f.known);
    if (S.settings.toPlay) setTab("play");
  });
}

export function cancelGenerate(): void {
  if (!genRun) return;
  genRun.cancelled = true;
  genRun = null;
  $("gen-msg").textContent = "Stopped.";
  renderGen();
}

export function setProfile(names: string[]): void {
  const known = TECHNIQUES.map((t) => t.name);
  S.settings.genProfile = known.filter((n) => names.includes(n) || ALWAYS_ON.includes(n));
  saveSettings();
  renderGen();
}

export function buildTechniqueToggles(): void {
  const list = $("tech-list");
  let group = "";
  for (const t of TECHNIQUES) {
    const g = groupOf(t.name);
    if (g !== group) {
      group = g;
      const h = document.createElement("div");
      h.className = "tech-group";
      h.textContent = g;
      list.appendChild(h);
    }
    const label = document.createElement("label");
    label.className = "tech-toggle";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.dataset.name = t.name;
    box.id = `tech-${t.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    if (ALWAYS_ON.includes(t.name)) box.disabled = true;
    box.addEventListener("change", () => {
      const on = new Set(S.settings.genProfile);
      if (box.checked) on.add(t.name);
      else on.delete(t.name);
      setProfile([...on]);
    });
    const span = document.createElement("span");
    span.textContent = t.name;
    label.append(box, span);
    list.appendChild(label);
  }
}

export function renderGen(): void {
  const busy = !!genRun;
  const name = profileName();
  ($("generate") as HTMLButtonElement).disabled = busy;
  $("generate").textContent = busy ? "Generating…" : `Generate ${name.toLowerCase()} puzzle`;
  $("print-batch").textContent = `Print ${name.toLowerCase()} puzzles`;
  $("gen-cancel").hidden = !busy;
  document.querySelectorAll<HTMLButtonElement>("#diff-pick button").forEach((b) => {
    const on = b.dataset.d === name;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
  const top = hardestGroup(S.settings.genProfile);
  $("diff-desc").textContent =
    name === "Custom"
      ? `Your own mix of techniques. Each puzzle needs at least one ${top.group.toLowerCase()} technique you ticked: ${top.names.join(", ")}.`
      : DIFF_DESC[name];
  const on = new Set(S.settings.genProfile);
  document.querySelectorAll<HTMLInputElement>("#tech-list input").forEach((box) => (box.checked = on.has(box.dataset.name!) || box.disabled));
  $("tech-count").textContent = `(${on.size} of ${TECHNIQUES.length} ticked)`;
}

export function rate(g: Grid): void {
  S.rating = ratePuzzle(g, MAX_ALT);
  renderRating();
  $("puzzle-name").textContent = currentName(); // a loaded puzzle's name follows its rating
}

export const GRIND_TEXT = {
  clean: "Clean",
  light: "Slightly grindy",
  heavy: "Grindy",
};

export function renderRating(): void {
  const el = $("rating");
  const r = S.rating;
  if (!r) {
    el.textContent = "Rating…";
    return;
  }
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tier = "Expert";
  const rows: string[] = [];
  if (r.solved) {
    rows.push(`<dt>Difficulty</dt><dd><span class="badge diff-${r.difficulty.toLowerCase()}">${r.difficulty}</span> Hardest step: ${esc(r.hardest?.technique ?? "singles only")}.</dd>`);
  } else {
    rows.push(`<dt>Difficulty</dt><dd><span class="badge diff-beyond">Beyond</span> The current techniques get stuck, so this puzzle can't be fully rated yet.</dd>`);
  }
  let grind = `<span class="badge grind-${r.grind}">${GRIND_TEXT[r.grind]}</span> `;
  if (!r.forced.length) {
    grind += r.grindOnEasiestPath
      ? `A triple, quad or long chain shows up, but there is always a pattern up to ${tier} level that works instead` +
        (r.hardestPatternFirst && r.hardestPatternFirst.level > (r.hardest?.level ?? 0)
          ? ` (the hardest one you'd need is ${esc(r.hardestPatternFirst.technique)}).`
          : ".")
      : `No triples, quads or long chains needed.`;
  } else {
    const list = r.forced.map((f) =>
      f.kind === "subset"
        ? `${f.technique} in ${f.where} (${f.emptyInUnit} empty cells, step ${f.step})`
        : `${f.technique} with ${f.digits} digits (step ${f.step})`,
    );
    grind += `${r.forced.length === 1 ? "Once" : `${r.forced.length} times`}, a triple, quad or long chain was the only way forward: ${esc(list.join("; "))}.`;
  }
  rows.push(`<dt>Grind</dt><dd>${grind}</dd>`);
  const used = r.used.map((u) => `${u.technique} ×${u.count}`);
  rows.push(`<dt>Solve path</dt><dd>${r.steps} steps, easiest move first: ${esc(used.join(", ") || "none")}.</dd>`);
  el.innerHTML = `<dl class="rating-list">${rows.join("")}</dl>`;
}
