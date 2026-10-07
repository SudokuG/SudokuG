// SudokuG puzzle generator: a small app for your own computer that makes good puzzles
// (all the moves and locks REQUIREMENTS asks for) for as long as you let it run.
//
// Start it with "SudokuG Generator.cmd" (Windows) or `npm run grow`. It opens a page in your
// browser with Start and Stop. Each good puzzle is saved straight away, alternately:
//   - to the daily puzzles: it replaces a Hard/Expert/Extreme daily that doesn't meet the
//     requirements yet (from the day after tomorrow on, so nobody's current daily changes),
//     and once they all do, new days are added at the end;
//   - to the library that "Generate" hands out.
// Stopping (or closing the window) loses at most the puzzles being worked on. To publish,
// commit and push src/daily-data.ts and src/library-data.ts (GitHub Desktop: Commit, Push).

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { DIFFICULTIES, seededRandom } from "../src/engine";
import type { Group } from "../src/engine";
import { dayOf, goodPuzzle, meetsRequirements, readDailies, readLibrary, writeDailies, writeLibrary } from "./common";

const HARD: Group[] = ["Hard", "Expert", "Extreme"];

if (!isMainThread) {
  // Worker: make one good puzzle per request.
  parentPort!.on("message", (g: Group) => {
    const p = goodPuzzle(g, Math.random);
    parentPort!.postMessage({ g, ...p });
  });
} else {
  main();
}

function main(): void {
  if (!existsSync("src/daily-data.ts") || !existsSync("src/library-data.ts")) {
    console.error("Start this from the SudokuG folder (where package.json is).");
    process.exit(1);
  }
  // Leave the computer responsive: run below normal priority.
  try {
    os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {
    /* not allowed here: fine */
  }

  const cores = os.cpus().length;
  const POOL_FILE = "scripts/grow-pool.json";
  const log: string[] = [];
  const say = (msg: string) => {
    const line = `${new Date().toLocaleTimeString()}  ${msg}`;
    log.push(line);
    if (log.length > 200) log.shift();
    console.log(line);
  };

  // ---- State ----------------------------------------------------------------
  let dailies = readDailies();
  let ok: Record<string, boolean[]> = {}; // ok[g][day]: daily meets the requirements
  let checked = false;
  // Puzzles waiting for a new day at the end (one of each hard difficulty makes a day).
  const pool: Record<string, string[]> = { Hard: [], Expert: [], Extreme: [] };
  try {
    Object.assign(pool, JSON.parse(readFileSync(POOL_FILE, "utf8")));
  } catch {
    /* none yet */
  }
  const found: Record<string, number> = { Hard: 0, Expert: 0, Extreme: 0 };
  const toDaily: Record<string, number> = { Hard: 0, Expert: 0, Extreme: 0 };
  const toLibrary: Record<string, number> = { Hard: 0, Expert: 0, Extreme: 0 };
  const assigned: Record<string, number> = { Hard: 0, Expert: 0, Extreme: 0 };
  const route: Record<string, number> = { Hard: 0, Expert: 0, Extreme: 0 };
  let workerCount = Math.min(2, cores);
  let running = false;
  let runningSince = 0;
  let runMs = 0;
  const workers: { w: Worker; g: Group | null }[] = [];

  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const dayIndex = (date: string) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${dailies.start}T12:00:00Z`)) / 86400000);
  /** First day that may still change: the day after tomorrow (so no one's current daily changes). */
  const firstChangeable = () => Math.max(0, dayIndex(localToday()) + 2);
  const firstShort = (g: string) => {
    const from = firstChangeable();
    for (let i = from; i < dailies.rows.length; i++) if (!ok[g][i]) return i;
    return -1;
  };

  /** Check every daily against the requirements, a few days at a time so the page stays responsive. */
  let pendingStart = 0;
  function checkDailies(): void {
    say("Checking the daily puzzles against the requirements…");
    dailies = readDailies();
    ok = Object.fromEntries(HARD.map((g) => [g, []]));
    let i = 0;
    const chunk = () => {
      for (const end = Math.min(i + 10, dailies.rows.length); i < end; i++)
        for (const g of HARD) ok[g][i] = meetsRequirements(dailies.rows[i][DIFFICULTIES.indexOf(g)], g);
      if (i < dailies.rows.length) return void setImmediate(chunk);
      checked = true;
      say(`Daily puzzles run until ${dayOf(dailies.start, dailies.rows.length - 1)}. Still short from the day after tomorrow on: ${HARD.map((g) => `${g} ${ok[g].slice(firstChangeable()).filter((x) => !x).length}`).join(", ")}.`);
      if (pendingStart) start(pendingStart);
    };
    chunk();
  }

  /** Add a new day at the end when the pool has one puzzle of each hard difficulty. */
  function appendDays(): void {
    while (HARD.every((g) => pool[g].length)) {
      const i = dailies.rows.length;
      const date = dayOf(dailies.start, i);
      const seedOf = (t: string) => [...t].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 2166136261);
      // Easy and Medium are quick: made here, seeded by the date like the other dailies.
      const row = DIFFICULTIES.map((g) => (HARD.includes(g) ? pool[g].shift()! : goodPuzzle(g, seededRandom(seedOf(`${date}/${g}`))).code));
      dailies.rows.push(row);
      for (const g of HARD) ok[g].push(true);
      say(`New day ${date} added to the daily puzzles.`);
    }
    writeFileSync(POOL_FILE, JSON.stringify(pool));
  }

  function store(g: Group, code: string): void {
    found[g]++;
    if (route[g]++ % 2 === 0) {
      // To the dailies.
      const i = firstShort(g);
      if (i >= 0) {
        dailies.rows[i][DIFFICULTIES.indexOf(g)] = code;
        ok[g][i] = true;
        writeDailies(dailies.start, dailies.rows);
        say(`${g}: daily for ${dayOf(dailies.start, i)}.`);
      } else {
        pool[g].push(code);
        say(`${g}: kept for a new day at the end of the dailies.`);
        appendDays();
        writeDailies(dailies.start, dailies.rows);
      }
      toDaily[g]++;
    } else {
      // To the library (read fresh, so likes added meanwhile are kept).
      const lib = readLibrary();
      if (!lib.library[g].includes(code)) lib.library[g].push(code);
      writeLibrary(lib.library, lib.likes);
      toLibrary[g]++;
      say(`${g}: added to the library (${lib.library[g].length} now).`);
    }
  }

  // ---- Workers ----------------------------------------------------------------
  /** The difficulty to make next: the one with the fewest made or in the works, so all three grow evenly. */
  const nextJob = (): Group => HARD.reduce((a, b) => (assigned[b] < assigned[a] ? b : a));

  function give(slot: { w: Worker; g: Group | null }): void {
    if (!running) return;
    const g = nextJob();
    assigned[g]++;
    slot.g = g;
    slot.w.postMessage(g);
  }

  function start(n: number): void {
    if (running) return;
    if (!checked) {
      // Starts as soon as the dailies are checked.
      pendingStart = n;
      say("Starting once the daily puzzles are checked…");
      return;
    }
    pendingStart = 0;
    workerCount = Math.max(1, Math.min(cores, n));
    running = true;
    runningSince = Date.now();
    for (const g of HARD) assigned[g] = found[g];
    for (let k = 0; k < workerCount; k++) {
      const slot: { w: Worker; g: Group | null } = { w: new Worker(__filename), g: null };
      slot.w.on("message", (m: { g: Group; code: string; missing: number }) => {
        slot.g = null;
        if (m.missing) say(`${m.g}: best try was ${m.missing} short, skipped.`);
        else store(m.g, m.code);
        give(slot);
      });
      slot.w.on("error", (e: Error) => say(`A worker failed: ${e.message}`));
      workers.push(slot);
      give(slot);
    }
    say(`Started with ${workerCount} worker${workerCount === 1 ? "" : "s"}.`);
  }

  function stop(): void {
    pendingStart = 0;
    if (!running) return;
    running = false;
    runMs += Date.now() - runningSince;
    for (const s of workers.splice(0)) {
      if (s.g) assigned[s.g]--;
      void s.w.terminate();
    }
    say("Stopped. Everything found so far is saved.");
  }

  // ---- Page -----------------------------------------------------------------------
  function status() {
    const lib = (() => {
      try {
        return readLibrary().library;
      } catch {
        return {};
      }
    })();
    return {
      running,
      starting: !!pendingStart,
      workers: pendingStart || workerCount,
      cores,
      busy: workers.filter((s) => s.g).map((s) => s.g),
      found,
      toDaily,
      toLibrary,
      pool: Object.fromEntries(HARD.map((g) => [g, pool[g].length])),
      library: Object.fromEntries(DIFFICULTIES.map((g) => [g, (lib as Record<string, string[]>)[g]?.length ?? 0])),
      dailies: checked
        ? {
            until: dayOf(dailies.start, dailies.rows.length - 1),
            short: Object.fromEntries(HARD.map((g) => [g, ok[g].slice(firstChangeable()).filter((x) => !x).length])),
            next: Object.fromEntries(HARD.map((g) => [g, firstShort(g) >= 0 ? dayOf(dailies.start, firstShort(g)) : null])),
          }
        : null,
      seconds: Math.round((runMs + (running ? Date.now() - runningSince : 0)) / 1000),
      log: log.slice(-14),
    };
  }

  const server = createServer((req, res) => {
    const send = (code: number, type: string, body: string) => {
      res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(body);
    };
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/") return send(200, "text/html; charset=utf-8", PAGE);
    if (req.method === "GET" && url.pathname === "/status") return send(200, "application/json", JSON.stringify(status()));
    if (req.method === "POST" && url.pathname === "/start") {
      start(Number(url.searchParams.get("workers")) || workerCount);
      return send(200, "application/json", JSON.stringify(status()));
    }
    if (req.method === "POST" && url.pathname === "/stop") {
      stop();
      return send(200, "application/json", JSON.stringify(status()));
    }
    if (req.method === "POST" && url.pathname === "/quit") {
      stop();
      send(200, "application/json", "{}");
      say("Closing. You can close this window.");
      setTimeout(() => process.exit(0), 300);
      return;
    }
    send(404, "text/plain", "Not found");
  });

  const listen = (port: number) => {
    server.once("error", (e: NodeJS.ErrnoException) => (e.code === "EADDRINUSE" ? listen(port + 1) : say(e.message)));
    server.listen(port, "127.0.0.1", () => {
      const url = `http://localhost:${port}/`;
      say(`SudokuG generator is open at ${url}  (keep this window open; Ctrl+C quits)`);
      if (!process.env.NO_BROWSER) openBrowser(url);
      setTimeout(checkDailies, 50);
    });
  };
  listen(Number(process.env.PORT ?? 5178));

  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });
}

function openBrowser(url: string): void {
  const cmd = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(cmd[0] as string, cmd[1] as string[], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
  } catch {
    /* open the address yourself */
  }
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>SudokuG generator</title>
<style>
  :root { --paper: #eef2f6; --surface: #fff; --ink: #16212c; --muted: #5d6976; --line: #c6cfd9; --pen: #1f55b0; --good: #2b8a57; --bad: #c33a2c; }
  @media (prefers-color-scheme: dark) { :root { --paper: #10151b; --surface: #182029; --ink: #e3e9ef; --muted: #93a0ad; --line: #34414f; --pen: #8db4ff; --good: #5fd394; --bad: #ff7a6b; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.45 "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 24px 16px 40px; display: flex; flex-direction: column; gap: 14px; }
  h1 { margin: 0; font-size: 1.5rem; letter-spacing: -0.02em; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
  .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  button { font: inherit; font-weight: 700; border-radius: 8px; padding: 9px 16px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
  button.primary { background: var(--pen); border-color: var(--pen); color: var(--surface); }
  button:disabled { opacity: 0.45; cursor: default; }
  select { font: inherit; padding: 7px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
  .state { font-weight: 700; }
  .state.on { color: var(--good); }
  table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  th, td { text-align: right; padding: 5px 8px; border-bottom: 1px solid var(--line); }
  th:first-child, td:first-child { text-align: left; }
  thead th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  .small { color: var(--muted); font-size: 0.88rem; margin: 6px 0 0; }
  pre { margin: 0; font: 0.8rem/1.5 ui-monospace, Consolas, monospace; white-space: pre-wrap; color: var(--muted); }
</style>
</head>
<body>
<main>
  <h1>SudokuG generator</h1>
  <div class="card controls">
    <button id="start" class="primary" type="button">Start</button>
    <button id="stop" type="button">Stop</button>
    <label>Workers <select id="workers"></select></label>
    <span id="state" class="state">…</span>
    <span id="time" class="small" style="margin:0"></span>
  </div>
  <div class="card">
    <table>
      <thead><tr><th></th><th>Found now</th><th>To dailies</th><th>To library</th><th>Library total</th><th>Dailies still short</th><th>Next daily to fill</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <p id="daily" class="small"></p>
    <p class="small">Each good puzzle goes alternately to the daily puzzles (replacing one that doesn't meet the requirements, from the day after tomorrow on, then new days at the end) and to the library. Everything is saved as soon as it is found. To publish: commit and push in GitHub Desktop.</p>
  </div>
  <div class="card"><pre id="log"></pre></div>
  <div><button id="quit" type="button">Close the generator</button></div>
</main>
<script>
const $ = (id) => document.getElementById(id);
let first = true;
async function call(path) { const r = await fetch(path, { method: path === "/status" ? "GET" : "POST" }); return r.json(); }
function show(s) {
  if (!s || !s.found) return;
  if (first) {
    for (let n = 1; n <= s.cores; n++) $("workers").add(new Option(n + (n === 1 ? " core" : " cores") + (n === s.cores ? " (all)" : ""), n));
    $("workers").value = s.workers;
    first = false;
  }
  $("state").textContent = s.running ? "Running" + (s.busy.length ? ": " + s.busy.join(", ") : "") : s.starting ? "Starting…" : "Stopped";
  $("state").classList.toggle("on", s.running);
  $("start").disabled = s.running || s.starting; $("stop").disabled = !s.running && !s.starting; $("workers").disabled = s.running;
  const t = s.seconds; $("time").textContent = t ? (Math.floor(t / 3600) + "h " + String(Math.floor(t / 60) % 60).padStart(2, "0") + "m " + String(t % 60).padStart(2, "0") + "s running in total") : "";
  $("rows").innerHTML = ["Hard", "Expert", "Extreme"].map((g) =>
    "<tr><td>" + g + "</td><td>" + s.found[g] + "</td><td>" + s.toDaily[g] + "</td><td>" + s.toLibrary[g] + "</td><td>" + s.library[g] +
    "</td><td>" + (s.dailies ? s.dailies.short[g] : "…") + "</td><td>" + (s.dailies ? (s.dailies.next[g] || "new day at the end") : "…") + "</td></tr>").join("");
  $("daily").textContent = s.dailies ? "Daily puzzles run until " + s.dailies.until + "." : "Checking the daily puzzles…";
  $("log").textContent = s.log.join("\\n");
}
async function tick() { try { show(await call("/status")); } catch { $("state").textContent = "Generator closed"; $("state").classList.remove("on"); } }
$("start").onclick = async () => show(await call("/start?workers=" + $("workers").value));
$("stop").onclick = async () => show(await call("/stop"));
$("quit").onclick = async () => { await call("/quit").catch(() => {}); $("state").textContent = "Generator closed"; };
tick(); setInterval(tick, 1000);
</script>
</body>
</html>
`;
