// SVG pieces for printing the lighter puzzle types: always black on white (entries in a
// dark blue), candidates in the middle of the cell like pairs in sudoku.

export const FONT = `"Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif`;

/** A digit centred at (x, y); givens bold black, entries dark blue. */
export const svgDigit = (x: number, y: number, v: number, given: boolean) =>
  `<text x="${x}" y="${y + 22}" text-anchor="middle" font-size="62" font-weight="${given ? 700 : 400}" fill="${given ? "#000" : "#1f4f9e"}">${v}</text>`;

/** An X centred at (x, y). */
export const svgX = (x: number, y: number, given: boolean) =>
  `<path d="M${x - 24} ${y - 24}L${x + 24} ${y + 24}M${x + 24} ${y - 24}L${x - 24} ${y + 24}" stroke="${given ? "#000" : "#1f4f9e"}" stroke-width="${given ? 9 : 7}" stroke-linecap="round"/>`;

const RING = 1 << 15;

/**
 * Candidates (bits of `mask`: 0 = an X note, 1..max) in a small frame in the middle of the
 * cell at (x, y); an empty ring (RING) means "a digit goes here".
 */
export function svgCands(x: number, y: number, mask: number, max: number): string {
  if (mask === RING) return `<rect x="${x - 15}" y="${y - 15}" width="30" height="30" rx="15" fill="none" stroke="#1f4f9e" stroke-width="3.5"/>`;
  const ds = Array.from({ length: max + 1 }, (_, k) => k).filter((d) => mask & (1 << d)).map((d) => (d ? String(d) : "✕"));
  if (!ds.length) return "";
  const size = ds.length > 5 ? 19 : ds.length > 3 ? 23 : 27;
  const w = ds.length * size * 0.62 + size * 0.9;
  const h = size * 1.45;
  return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="#fff" stroke="#1f4f9e" stroke-width="2.5"/><text x="${x}" y="${y + size * 0.36}" text-anchor="middle" font-size="${size}" font-weight="700" fill="#1f4f9e">${ds.join("")}</text>`;
}

/** Cell content (digit, X or candidates) for printing. */
export function svgCell(x: number, y: number, given: boolean, v: number, cands: number, max: number): string {
  if (v > 0) return svgDigit(x, y, v, given);
  if (v === 0) return svgX(x, y, given);
  return cands ? svgCands(x, y, cands, max) : "";
}
