// Builds the game from src/:
//   dist/index.html     – one self-contained file (fonts included), works offline by double-click
//   dist/artifact.html  – the same page without the <html>/<head> wrapper (for a Claude artifact)
//   site/               – the website for GitHub Pages: index.html + PWA files (manifest,
//                         service worker for offline use, icons)
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const APP_NAME = "SudokuG";

const js = await build({
  entryPoints: ["src/ui/app.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  write: false,
});
const script = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync("src/ui/style.css", "utf8");

// Fonts are embedded as data URIs, so the page needs no internet connection.
const font = (family, weight, file) => {
  const data = readFileSync(`node_modules/@fontsource/${file}`).toString("base64");
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2")}`;
};
const fonts = [
  font("Atkinson Hyperlegible", 400, "atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2"),
  font("Atkinson Hyperlegible", 700, "atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2"),
  font("Bricolage Grotesque", 800, "bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2"),
].join("\n");

const page = readFileSync("src/page.html", "utf8")
  .replace("/*FONTS*/", () => fonts)
  .replace("/*STYLE*/", () => css)
  .replace("/*SCRIPT*/", () => script);

const wrap = (head, body) =>
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/artifact.html", page);
writeFileSync("dist/index.html", wrap("", page));

// ---- Website with PWA support ----
rmSync("site", { recursive: true, force: true });
mkdirSync("site", { recursive: true });
cpSync("public", "site", { recursive: true });
const pwaHead = [
  `<meta name="description" content="Sudoku player and generator with human-style hints and puzzles without grind.">`,
  `<link rel="manifest" href="manifest.webmanifest">`,
  `<link rel="icon" type="image/png" href="favicon.png">`,
  `<link rel="apple-touch-icon" href="apple-touch-icon.png">`,
  `<meta name="theme-color" content="#eef2f6" media="(prefers-color-scheme: light)">`,
  `<meta name="theme-color" content="#10151b" media="(prefers-color-scheme: dark)">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-title" content="${APP_NAME}">`,
].join("\n");
const register = `<script>if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));</script>`;
const siteHtml = wrap(pwaHead, page + "\n" + register);
writeFileSync("site/index.html", siteHtml);
writeFileSync(
  "site/manifest.webmanifest",
  JSON.stringify(
    {
      name: APP_NAME,
      short_name: APP_NAME,
      description: "Sudoku player and generator with human-style hints and puzzles without grind.",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#eef2f6",
      theme_color: "#16212c",
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  ),
);
// The cache name changes with every build, so a new version replaces the old one.
const version = createHash("sha256").update(siteHtml).digest("hex").slice(0, 12);
writeFileSync(
  "site/sw.js",
  readFileSync("src/sw.js", "utf8").replace("__VERSION__", version),
);
console.log(`Built dist/index.html (${(page.length / 1024).toFixed(0)} KB) and site/ (version ${version})`);
