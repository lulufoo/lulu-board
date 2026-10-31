import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  NOTE_FOLD, NOTE_RADIUS, HOVER_GAP, HOVER_WIDTH, SELECT_GAP, SELECT_WIDTH,
  HOVER_CENTER, SELECT_CENTER, noteRingPath,
} = require('../../../packages/boxes/item/note-ring.js');
const { View } = require('../../../packages/boxes/model.js');
const fitNoteRings = View.fitNoteRings;
assert.strictEqual(typeof fitNoteRings, 'function', 'note registers View.fitNoteRings');
const { ring } = require('../../../packages/board-themes/index.js');

const root = path.join(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// ---- geometry: the path is the paper outline pushed outward by d ----
{
  const w = 248;
  const h = 104;
  const d = 3;
  const f = NOTE_FOLD;
  // top y = -d, right x = w + d, bottom y = h + d, left x = -d; corner arcs grow to radius 4 + d
  assert.strictEqual(noteRingPath(w, h, d), [
    'M -3 4', 'A 7 7 0 0 1 4 -3', 'L 226 -3',
    'A 3 3 0 0 1 228.121 -2.121', 'L 250.121 19.879', 'A 3 3 0 0 1 251 22',
    'L 251 100', 'A 7 7 0 0 1 244 107', 'L 4 107', 'A 7 7 0 0 1 -3 100', 'Z',
  ].join(' '), 'ring path for a 248 x 104 paper at d = 3');
  // the cut corner is parallel to the paper's own cut (x - y = w - f), d away from it
  const diagonal = /L 226 -3 A 3 3 0 0 1 [\d.-]+ [\d.-]+ L ([\d.-]+) ([\d.-]+)/.exec(noteRingPath(w, h, d));
  assert.ok(diagonal, 'cut corner leg');
  const dist = (Number(diagonal[1]) - Number(diagonal[2]) - (w - f)) / Math.SQRT2;
  assert.ok(Math.abs(dist - d) < 0.002, 'cut corner stays d away from the paper cut, got ' + dist);
  assert.strictEqual(noteRingPath(0, 10, 3), '', 'no paper, no ring');
  assert.strictEqual(noteRingPath(100, 50, -1), '', 'no negative offset');
}

// ---- the stroke is centred on the path, so the path sits gap + width / 2 out ----
assert.strictEqual(SELECT_CENTER, SELECT_GAP + SELECT_WIDTH / 2);
assert.strictEqual(HOVER_CENTER, HOVER_GAP + HOVER_WIDTH / 2);
assert.strictEqual(SELECT_CENTER, 3, 'selected: inner edge 2px from the paper');
assert.strictEqual(HOVER_CENTER, 3.5, 'hover: inner edge 3px from the paper');
assert.strictEqual(SELECT_GAP, ring.offset, 'selected gap is the shared ring offset');
assert.strictEqual(SELECT_WIDTH, ring.width, 'selected width is the shared ring width');

// ---- constants stay in step with the CSS they mirror ----
{
  const diagram = read('packages/drawer-app/css/03-diagram.css');
  const form = read('packages/drawer-app/css/04-board-form.css');
  const fold = /board-item-note-sheet \{[^}]*clip-path:\s*polygon\(0 0, calc\(100% - (\d+)px\) 0, 100% (\d+)px/.exec(diagram);
  assert.ok(fold, 'note sheet has the dog-ear clip-path');
  assert.strictEqual(Number(fold[1]), NOTE_FOLD, 'dog-ear width');
  assert.strictEqual(Number(fold[2]), NOTE_FOLD, 'dog-ear height');
  const radius = /board-item-note-sheet \{[^}]*border-radius:\s*(\d+)px/.exec(form);
  assert.ok(radius && Number(radius[1]) === NOTE_RADIUS, 'paper corner radius');
  assert.match(form, new RegExp('--canvas-ring-offset:\\s*' + ring.offset + 'px'), 'ring offset token');
  assert.match(form, new RegExp('--canvas-ring-width:\\s*' + ring.width + 'px'), 'ring width token');
  const hover = /\.board-item:hover:not\(\.canvas-selected\)[^{]*\{\s*outline:\s*(\d+)px dashed[^;]*;\s*outline-offset:\s*(\d+)px/.exec(diagram);
  assert.ok(hover, 'global hover outline');
  assert.strictEqual(Number(hover[1]), HOVER_WIDTH, 'hover width');
  assert.strictEqual(Number(hover[2]), HOVER_GAP, 'hover gap');
}

// ---- CSS: a note swaps its rectangular outline for the ring paths ----
{
  const diagram = read('packages/drawer-app/css/03-diagram.css');
  assert.match(diagram, /\.board-item-note\.canvas-selected,\s*\.board-render \.board-item-note\.board-selection \{ outline: none !important; \}/, 'note drops the rectangular outline');
  assert.match(diagram, /\.board-item-note-ring path \{ fill: none; visibility: hidden; \}/, 'rings are hidden by default');
  assert.match(diagram, /\.board-item-note\.canvas-selected \.board-item-note-ring-select/, 'selected ring is shown on .canvas-selected');
  assert.match(diagram, /\.board-item-note:hover:not\(\.canvas-selected\)[^{]*\.board-item-note-ring-hover/, 'hover ring is shown on :hover');
  assert.match(diagram, /\.board-item-note-ring-select \{[^}]*stroke:\s*var\(--canvas-ring,[^}]*stroke-width:\s*var\(--canvas-ring-width/, 'selected ring reads the shared tokens');
  assert.match(diagram, /\.board-item-note-ring-hover \{[^}]*stroke:\s*var\(--canvas-ring-soft,[^}]*stroke-dasharray/, 'hover ring is the soft dashed ring');
}

// ---- CSS: layout corners match the chip corner; the ring tokens are untouched ----
{
  const diagram = read('packages/drawer-app/css/03-diagram.css');
  const form = read('packages/drawer-app/css/04-board-form.css');
  assert.match(diagram, /\.board-render \.board-layout \{[^}]*border-radius:\s*var\(--bf-radius-chip, 8px\);/, 'layout radius follows the chip radius');
  assert.match(form, /--bf-radius-chip:\s*8px/, 'chip radius');
}

// ---- engine: the ring is mounted with the note and fitted after layout ----
{
  const note = read('packages/boxes/item/note.js');
  const render = read('packages/boxes/engine/render.js');
  assert.match(note, /el\.appendChild\(mountRing\(ctx\.doc\)\)/, 'note mounts the ring');
  assert.match(note, /svg\.setAttribute\('width', '0'\);\s*\n\s*svg\.setAttribute\('height', '0'\);/, 'ring starts at zero size so it never inflates the measured note');
  assert.match(note, /View\.fitNoteRings = fitNoteRings/, 'note registers the fit hook');
  assert.match(render, /View\.fitChipDiamonds\(root\);\s*\n\s*if \(View && typeof View\.fitNoteRings === 'function'\) View\.fitNoteRings\(root\);/, 'render fits note rings after layout');
}

// ---- fit: paths follow the live paper size, fractions kept ----
{
  const attrs = () => ({ map: {}, setAttribute(key, value) { this.map[key] = value; } });
  const hover = attrs();
  const select = attrs();
  const svg = Object.assign(attrs(), {
    querySelector(sel) { return /hover/.test(sel) ? hover : select; },
  });
  const el = {
    ownerDocument: { defaultView: { getComputedStyle: () => ({ width: '248.4px', height: '104.125px' }) } },
    querySelector: () => svg,
  };
  fitNoteRings({ querySelectorAll: () => [el] });
  assert.strictEqual(svg.map.width, '248.4');
  assert.strictEqual(svg.map.height, '104.125');
  assert.strictEqual(svg.map.viewBox, '0 0 248.4 104.125');
  assert.strictEqual(hover.map.d, noteRingPath(248.4, 104.125, HOVER_CENTER));
  assert.strictEqual(select.map.d, noteRingPath(248.4, 104.125, SELECT_CENTER));
  assert.match(hover.map.d, /^M -3\.5 4 /);
  assert.match(select.map.d, /^M -3 4 /);
}

console.log('ok note-ring');
