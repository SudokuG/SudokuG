// Starting, making, saving and restoring a puzzle; stats; printing; the share link.

import { DOT, RING } from "../logic";
import { openPrintDialog } from "../../ui/print-dialog";
import type { PrintPuzzle } from "../../ui/print";
import { esc, fmtTime } from "./markup";
import type { LiteCtx } from "./ctx";
import type { LitePuzzle } from "./types";

export function puzzlesPart<P extends LitePuzzle>(ctx: LiteCtx<P>) {
  const { g, el, btn, opt, S, n, nameOf, status } = ctx;

  const SAVE_KEY = `sudokug-${g.id}`;
  const STATS_KEY = `sudokug-${g.id}-stats`;
  const statsKey = () => `${n()}×${n()} ${S.level}`;
  function start(p: P, level?: string): void {
    S.p = p;
    S.code = g.encode(p);
    S.level = level ?? g.levelOf(p);
    S.cur = { cells: p.solution.map((v, i) => (p.givens[i] ? v : -1)), cands: new Array(p.n * p.n).fill(0) };
    S.undo = [];
    S.redo = [];
    S.sel = Math.max(0, p.givens.findIndex((x) => !x));
    S.selection = new Set([S.sel]);
    S.selOrder = [S.sel];
    S.quiet = !!g.smartInput && opt.smart;
    S.elapsed = 0;
    S.solved = false;
    S.hints = 0;
    S.hint = null;
    S.wrong.clear();
    S.notes = {};
    S.noteFocus = null;
    el("note-list")?.replaceChildren();
    S.lastInput = Date.now();
    ctx.buildBoard();
    ctx.buildPad();
    status("");
    ctx.render();
    save();
  }

  /** Make a new puzzle of the picked size and level, a slice at a time. */
  function make(size: number, level: string, done: (p: P) => void, progress?: () => void): void {
    const it = g.make(size, level, Math.random);
    const step = () => {
      const t0 = performance.now();
      let r = it.next();
      while (!r.done && performance.now() - t0 < 30) r = it.next();
      if (r.done) return done(r.value);
      progress?.();
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  function newPuzzle(): void {
    if (S.making) return;
    S.making = true;
    btn("new").disabled = true;
    status(`Making a ${S.pickLevel.toLowerCase()} ${g.noun}…`);
    make(S.pickSize, S.pickLevel, (p) => {
      S.making = false;
      btn("new").disabled = false;
      start(p, S.pickLevel);
      if (opt.toPlay) ctx.setTab("play");
    });
  }

  // ---- Saving ------------------------------------------------------------------------
  function save(): void {
    if (!S.p) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, code: S.code, level: S.level, cur: S.cur, elapsed: S.elapsed, solved: S.solved, hints: S.hints, pickSize: S.pickSize, pickLevel: S.pickLevel, notes: S.notes }));
    } catch {
      /* storage full or unavailable */
    }
  }

  function restore(code?: string): boolean {
    try {
      const f = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
      if (!f || (f.v !== 1 && f.v !== 2) || typeof f.code !== "string") return false;
      if (g.sizes.includes(f.pickSize)) S.pickSize = f.pickSize;
      if (g.levels.includes(f.pickLevel)) S.pickLevel = f.pickLevel;
      if (code && f.code !== code) return false;
      const p = g.decode(f.code);
      const size = p.n * p.n;
      if (!Array.isArray(f.cur?.cells) || f.cur.cells.length !== size || !Array.isArray(f.cur.cands) || f.cur.cands.length !== size) return false;
      start(p, g.levels.includes(f.level) ? f.level : undefined);
      const lo = g.xPerLine ? DOT : -1;
      const hiX = g.xPerLine ? 0 : 1;
      // Never let a saved state change the givens.
      const cells: number[] = f.cur.cells.map((v: number, i: number) => (p.givens[i] ? p.solution[i] : Number.isInteger(v) && v >= lo && v <= g.maxDigit(p.n) && (v < 0 || v >= hiX) ? v : -1));
      const cands: number[] = f.cur.cands.map((x: number) => (Number.isInteger(x) ? x : 0));
      // Saves from before the ring: a dot ("a digit goes here") becomes a ring, or drops the ✕ note.
      cells.forEach((v, i) => {
        if (v !== DOT) return;
        cells[i] = -1;
        cands[i] = cands[i] & ~1 & ~RING ? cands[i] & ~1 : RING;
      });
      S.cur = { cells, cands };
      S.elapsed = Math.max(0, Number(f.elapsed) || 0);
      S.solved = !!f.solved;
      S.hints = Number(f.hints) || 0;
      if (f.notes && typeof f.notes === "object")
        for (const [k, t] of Object.entries(f.notes)) if (typeof t === "string" && t) S.notes[Number(k)] = t;
      ctx.render();
      return true;
    } catch {
      return false;
    }
  }

  // ---- Stats -------------------------------------------------------------------------
  type Stats = Record<string, { solved: number; best: number | null; total: number }>;
  const loadStats = (): Stats => {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") ?? {};
    } catch {
      return {};
    }
  };
  function recordSolve(): string {
    const st = loadStats();
    const key = statsKey();
    const c = (st[key] ??= { solved: 0, best: null, total: 0 });
    c.solved++;
    c.total += S.elapsed;
    let best = false;
    if (!S.hints && (c.best === null || S.elapsed < c.best)) {
      best = c.best !== null;
      c.best = S.elapsed;
    }
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(st));
    } catch {
      /* ignore */
    }
    renderStats();
    const help = S.hints ? `${S.hints} hint${S.hints === 1 ? "" : "s"} or revealed cell${S.hints === 1 ? "" : "s"}` : "no help";
    return [`${key}, ${help}.`, best ? "A new best time!" : c.best !== null ? `Your best: ${fmtTime(c.best)}.` : "", `Solved ${c.solved} of these so far.`].filter(Boolean).join(" ");
  }
  function renderStats(): void {
    const st = loadStats();
    const order = (k: string) => {
      const [size, level] = k.split(" ");
      return parseInt(size, 10) * 10 + g.levels.indexOf(level);
    };
    const rows = Object.keys(st)
      .sort((a, b) => order(a) - order(b))
      .map((k) => `<tr><th scope="row">${esc(k)}</th><td>${st[k].solved}</td><td>${st[k].best === null ? "–" : fmtTime(st[k].best!)}</td><td>${fmtTime(st[k].total / st[k].solved)}</td></tr>`);
    el("stats").innerHTML = rows.length
      ? `<div class="table-wrap"><table class="stats-table"><thead><tr><th></th><th>Solved</th><th>Best</th><th>Average</th></tr></thead><tbody>${rows.join("")}</tbody></table></div><p class="small">Kept in this browser only. Best times count games without hints or revealed cells.</p>`
      : `<p class="small">No puzzles finished yet.</p>`;
  }
  // ---- Printing ----------------------------------------------------------------------
  function printPuzzle(p: P, level: string, progress: boolean): PrintPuzzle {
    const code = g.encode(p);
    return {
      givens: [],
      svg: progress ? g.svg(p, S.cur.cells, S.cur.cands) : g.svg(p),
      name: nameOf(code, level),
      difficulty: `${g.title} · ${level} ${p.n}×${p.n}`,
      code,
    };
  }

  function openPrint(many: boolean): void {
    if (!many) {
      if (!S.p) return;
      const progress = S.cur.cells.some((v, i) => v !== -1 && !S.p!.givens[i]) || S.cur.cands.some(Boolean);
      return openPrintDialog({
        title: "Print this puzzle",
        what: `${nameOf(S.code, S.level)} · ${g.title} · ${S.level} ${n()}×${n()}`,
        offerProgress: progress,
        many: false,
        collect: (choice, _msg, done) => done([printPuzzle(S.p!, S.level, choice.progress)]),
      });
    }
    const size = S.pickSize;
    const level = S.pickLevel;
    openPrintDialog({
      title: `Print ${level.toLowerCase()} ${g.title}`,
      what: `New ${level.toLowerCase()} ${size}×${size} ${g.noun}s, made just for this printout.`,
      offerProgress: false,
      many: true,
      collect: (choice, msg, done, run) => {
        const out: PrintPuzzle[] = [];
        const next = () => {
          if (run.cancelled) return;
          if (out.length === choice.count) return done(out);
          msg(`Making ${g.noun}s: ${out.length + 1} of ${choice.count}…`);
          make(size, level, (p) => {
            out.push(printPuzzle(p, level, false));
            next();
          });
        };
        next();
      },
    });
  }
  function copyLink(): void {
    const url = `${location.origin}${location.pathname}#${S.code}`;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => status("Link copied.", "good"), () => status(url));
    else status(url);
  }

  return { copyLink, newPuzzle, openPrint, printPuzzle, recordSolve, renderStats, restore, save, start };
}
