// SVG pieces for printing the lighter puzzle types: always black on white (entries in a
// dark blue), candidates in the middle of the cell like pairs in sudoku.

export const FONT = `"Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif`;

/** A digit centred at (x, y); givens bold black, entries dark blue. */
export const svgDigit = (x: number, y: number, v: number, given: boolean) =>
  `<text x="${x}" y="${y + 22}" text-anchor="middle" font-size="62" font-weight="${given ? 700 : 400}" fill="${given ? "#000" : "#1f4f9e"}">${v}</text>`;

/** An X centred at (x, y). */
export const svgX = (x: number, y: number, given: boolean) =>
  `<path d="M${x - 24} ${y - 24}L${x + 24} ${y + 24}M${x + 24} ${y - 24}L${x - 24} ${y + 24}" stroke="${given ? "#000" : "#1f4f9e"}" stroke-width="${given ? 9 : 7}" stroke-linecap="round"/>`;

/** Candidate digits (bits of `mask`, 1..max) in the middle of the cell at (x, y). */
export function svgCands(x: number, y: number, mask: number, max: number): string {
  const ds = Array.from({ length: max }, (_, k) => k + 1).filter((d) => mask & (1 << d));
  if (!ds.length) return "";
  const size = ds.length > 5 ? 20 : ds.length > 3 ? 25 : 30;
  return `<text x="${x}" y="${y + size * 0.36}" text-anchor="middle" font-size="${size}" fill="#333">${ds.join("")}</text>`;
}

/** Cell content (digit, X or candidates) for printing. */
export function svgCell(x: number, y: number, given: boolean, v: number, cands: number, max: number): string {
  if (v > 0) return svgDigit(x, y, v, given);
  if (v === 0) return svgX(x, y, given);
  return cands ? svgCands(x, y, cands, max) : "";
}
