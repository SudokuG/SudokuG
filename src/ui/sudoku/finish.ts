// Finishing a puzzle: stats, the solved card, likes, the daily puzzles.

import { DIFFICULTIES } from "../../engine";
import { dailyPuzzle, formatDay, today } from "../daily";
import { isLiked, likedList } from "../likes";
import { addSolve, loadStats } from "../stats";
import { nameOf, openPuzzle } from "./puzzles";
import { $, fmtTime, setStatus, setTab } from "./render";
import { S } from "./state";


/** Stats group for the current game. */
export function statsCategory(): string {
  if (S.daily) return S.daily.difficulty;
  if ((DIFFICULTIES as readonly string[]).includes(S.label) || S.label === "Custom") return S.label;
  return "Other";
}

export function recordSolve(): void {
  const category = statsCategory();
  const { stats, newBest } = addSolve({ category, time: S.elapsed, hints: S.hintsUsed, daily: S.daily });
  const c = stats.byCategory[category];
  const parts = [`${S.daily ? `Daily ${S.daily.difficulty}` : category}`, S.hintsUsed ? `${S.hintsUsed} hint${S.hintsUsed === 1 ? "" : "s"}` : "no hints"];
  let best = "";
  if (newBest) best = "A new best time!";
  else if (c.best !== null) best = `Your best ${category.toLowerCase()} time: ${fmtTime(c.best)}.`;
  const count = `Solved ${c.solved} ${category === "Other" ? "other" : category.toLowerCase()} puzzle${c.solved === 1 ? "" : "s"} so far.`;
  S.solvedNote = [`${parts.join(" · ")}.`, best, count].filter(Boolean).join(" ");
  setStatus(`Solved in ${fmtTime(S.elapsed)}.`, "good");
  renderStats();
  renderDaily();
}

/** Which profile "New puzzle" uses after finishing, or null when there is no obvious one. */
export function nextProfile(): string | null {
  if (S.daily) return S.daily.difficulty;
  if ((DIFFICULTIES as readonly string[]).includes(S.label) || S.label === "Custom") return S.label;
  return null;
}

export function renderSolved(): void {
  const card = $("solved-card");
  card.hidden = !S.solved || !S.puzzle;
  if (card.hidden) return;
  $("solved-time").textContent = fmtTime(S.elapsed);
  $("solved-text").textContent = S.solvedNote;
  const next = nextProfile();
  $("solved-new").hidden = !next;
  if (next) $("solved-new").textContent = `New ${next.toLowerCase()} puzzle`;
  renderLikeButton();
}

export function renderLikeButton(): void {
  const liked = !!S.puzzle && isLiked(S.puzzle);
  const b = $("solved-like");
  b.classList.toggle("on", liked);
  b.setAttribute("aria-pressed", String(liked));
  b.innerHTML = `<span aria-hidden="true">${liked ? "♥" : "♡"}</span> ${liked ? "Liked" : "Like"}`;
  b.title = liked ? "Liked: you'll find it under Puzzles › Liked puzzles. Tap to unlike." : "Keep this puzzle under Puzzles › Liked puzzles";
}

export function renderLikes(): void {
  const list = likedList();
  const el = $("likes");
  $("likes-share").hidden = !list.length;
  if (!list.length) {
    el.innerHTML = `<p class="small">None yet. When you finish a puzzle you enjoyed, tap Like and it shows up here.</p>`;
    return;
  }
  el.replaceChildren(
    ...list.map((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "liked";
      b.classList.toggle("on", l.puzzle === S.puzzle);
      const when = new Date(l.at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
      const name = document.createElement("span");
      name.className = "liked-name";
      name.textContent = `♥ ${nameOf(l.puzzle, l.label)}`;
      const meta = document.createElement("small");
      meta.textContent = `${l.label} · ${l.time !== null ? `${fmtTime(l.time)} · ` : ""}liked ${when}`;
      b.append(name, meta);
      b.addEventListener("click", () => {
        const err = openPuzzle(l.code, l.label);
        if (err) return void ($("puzzle-msg").textContent = err);
        setTab("play");
      });
      return b;
    }),
  );
}

export function renderStats(): void {
  const st = loadStats();
  const cats = [...DIFFICULTIES, "Custom", "Other"].filter((c) => st.byCategory[c]);
  const el = $("stats");
  if (!cats.length) {
    el.innerHTML = `<p class="small">No puzzles finished yet.</p>`;
    return;
  }
  const rows = cats
    .map((c) => {
      const x = st.byCategory[c];
      return `<tr><th scope="row">${c}</th><td>${x.solved}</td><td>${x.best === null ? "–" : fmtTime(x.best)}</td><td>${fmtTime(x.total / x.solved)}</td></tr>`;
    })
    .join("");
  const dailies = Object.keys(st.daily).length;
  el.innerHTML = `<div class="table-wrap"><table class="stats-table"><thead><tr><th></th><th>Solved</th><th>Best</th><th>Average</th></tr></thead><tbody>${rows}</tbody></table></div><p class="small">Daily puzzles finished: ${dailies}.</p>`;
}

export function renderDaily(): void {
  const date = today();
  $("daily-date").textContent = formatDay(date);
  const st = loadStats();
  document.querySelectorAll<HTMLButtonElement>("#daily-pick button").forEach((b) => {
    const g = b.dataset.d!;
    const done = st.daily[`${date}/${g}`];
    const available = !!dailyPuzzle(date, g);
    b.disabled = !available;
    b.classList.toggle("done", done !== undefined);
    b.classList.toggle("on", !!S.daily && S.daily.date === date && S.daily.difficulty === g);
    b.innerHTML = `<span>${g}</span><small>${done !== undefined ? `✓ ${fmtTime(done)}` : available ? "Play" : "–"}</small>`;
  });
}

export function openDaily(difficulty: string): void {
  const date = today();
  const p = dailyPuzzle(date, difficulty);
  if (!p) return;
  const err = openPuzzle(p.code, `Daily ${difficulty}`, { daily: { date, difficulty }, author: p.author });
  if (err) return setStatus(err, "bad");
  renderDaily();
  setTab("play");
}
