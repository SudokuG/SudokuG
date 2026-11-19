// What the number pads of the sudoku page and the light page share: sweeping over the keys,
// and the phone's S key. Each page wires them with its own hooks (sudoku/pad.ts, games/lite/pad.ts).

/** A page's part of a sweep. T is what the page remembers from the first touch. */
export interface SweepHooks<T> {
  /** The first touch on key v: remember what a sweep needs, then act on the key. Null: no sweep. */
  down(v: number, e: PointerEvent): T | null;
  /** May the sweep take in key v (first: the key it started on)? */
  allowed(t: T, first: number, v: number): boolean;
  /** The sweep starts on its second key: undo what the first key did and put it in as a
   * candidate instead. Returns whether the sweep adds (true) or removes candidates. */
  start(t: T, first: number): boolean;
  /** Add or remove candidate v. */
  toggle(t: T, v: number, add: boolean): void;
  render(): void;
  /** The finger lifts. started: the sweep took in a second key. */
  end(t: T, started: boolean): void;
}

/**
 * Pad keys act on the first touch (a phone drops the click when the finger moves a little,
 * or for a second finger while S is held). Sliding the finger on over other keys (a sweep)
 * toggles those as candidates too, all in one undo step: the first key decides whether the
 * sweep adds or removes them. Keys are the elements with data-<attr> = their value.
 */
export function wireSweep<T>(pad: HTMLElement, attr: string, h: SweepHooks<T>): void {
  let sw: { id: number; keys: number[]; t: T; add: boolean | null } | null = null;
  const sel = `[data-${attr}]`;
  const keyAt = (x: number, y: number): number | null => {
    const k = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(sel);
    return k && pad.contains(k) ? Number(k.getAttribute(`data-${attr}`)) : null;
  };
  pad.addEventListener("pointerdown", (e) => {
    const v = keyAt(e.clientX, e.clientY);
    if (v === null || e.button > 0) return;
    e.preventDefault();
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic event */
    }
    const t = h.down(v, e);
    sw = t === null ? null : { id: e.pointerId, keys: [v], t, add: null };
  });
  pad.addEventListener("pointermove", (e) => {
    if (!sw || sw.id !== e.pointerId) return;
    const v = keyAt(e.clientX, e.clientY);
    if (v === null || sw.keys.includes(v) || !h.allowed(sw.t, sw.keys[0], v)) return;
    if (sw.add === null) sw.add = h.start(sw.t, sw.keys[0]);
    sw.keys.push(v);
    h.toggle(sw.t, v, sw.add);
    h.render();
  });
  const end = (e: PointerEvent) => {
    if (!sw || sw.id !== e.pointerId) return;
    const done = sw;
    sw = null;
    h.end(done.t, done.add !== null);
  };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);
}

/**
 * The S key (phones): like a held Shift key. Normally on while held; with "S key stays on",
 * one touch switches it on and the next off. It acts on the first touch, like the other keys.
 */
export function wireSKey(b: HTMLButtonElement, h: { staysOn(): boolean; isOn(): boolean; set(on: boolean): void }): void {
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (h.staysOn()) return h.set(!h.isOn());
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer (synthetic event): S stays on until pointerup anyway */
    }
    h.set(true);
  });
  const release = () => !h.staysOn() && h.isOn() && h.set(false);
  b.addEventListener("pointerup", release);
  b.addEventListener("pointercancel", release);
  b.addEventListener("lostpointercapture", release);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
  // A click without a pointer (keyboard: Enter or Space on the key).
  b.addEventListener("click", (e) => e.detail === 0 && h.staysOn() && h.set(!h.isOn()));
}
