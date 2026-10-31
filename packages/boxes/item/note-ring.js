/* Note ring geometry. The paper is a rounded rectangle with a cut top-right
 * corner (the dog-ear). A CSS outline is always a rectangle, so the ring is an
 * SVG path pushed outward from the paper edge.
 * An SVG stroke is centred on its path. The path therefore sits at
 * `gap + width / 2` from the paper: the stroke's inner edge is then exactly
 * `gap` away, the same meaning as CSS outline-offset. */
import { ring } from '../../board-themes/index.js';

// Paper shape. Keep in step with the note rules in 03-diagram.css and 04-board-form.css.
export const NOTE_RADIUS = 4;
export const NOTE_FOLD = 22;
// Hover is 1px dashed at outline-offset 3px (`.canvas-hover` in 03-diagram.css).
export const HOVER_WIDTH = 1;
export const HOVER_GAP = 3;
// Selected reads the shared ring tokens.
export const SELECT_WIDTH = ring.width;
export const SELECT_GAP = ring.offset;

export const HOVER_CENTER = HOVER_GAP + HOVER_WIDTH / 2;
export const SELECT_CENTER = SELECT_GAP + SELECT_WIDTH / 2;

const HALF_SQRT2 = Math.SQRT1_2;

function num(value) {
  return String(Math.round(value * 1000) / 1000);
}

/* Outline of the paper moved outward by `d` (round joins), in paper coordinates:
 * the paper spans (0, 0) to (w, h). Clockwise from the left edge. */
export function noteRingPath(w, h, d) {
  if (!(w > 0) || !(h > 0) || !(d >= 0)) return '';
  const r = Math.min(NOTE_RADIUS, w / 2, h / 2);
  const f = Math.min(NOTE_FOLD, w - r, h - r);
  const ro = r + d;
  const s = d * HALF_SQRT2;
  return [
    'M ' + num(-d) + ' ' + num(r),
    'A ' + num(ro) + ' ' + num(ro) + ' 0 0 1 ' + num(r) + ' ' + num(-d),
    'L ' + num(w - f) + ' ' + num(-d),
    'A ' + num(d) + ' ' + num(d) + ' 0 0 1 ' + num(w - f + s) + ' ' + num(-s),
    'L ' + num(w + s) + ' ' + num(f - s),
    'A ' + num(d) + ' ' + num(d) + ' 0 0 1 ' + num(w + d) + ' ' + num(f),
    'L ' + num(w + d) + ' ' + num(h - r),
    'A ' + num(ro) + ' ' + num(ro) + ' 0 0 1 ' + num(w - r) + ' ' + num(h + d),
    'L ' + num(r) + ' ' + num(h + d),
    'A ' + num(ro) + ' ' + num(ro) + ' 0 0 1 ' + num(-d) + ' ' + num(h - r),
    'Z',
  ].join(' ');
}
