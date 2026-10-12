'use strict';
const assert = require('assert');
const Tone = require('../../../packages/board/themes/tone');

// gap rule
assert.strictEqual(Tone.ok(2, 0), true);
assert.strictEqual(Tone.ok(1, 0), false, 'adjacent tones are too close');
assert.strictEqual(Tone.ok(0, 0), false, 'same tone is too close');
assert.strictEqual(Tone.ok(5, null), true, 'no parent, no constraint');
assert.deepStrictEqual(Tone.allowed(3), [true, true, false, false, false, true, true, true]);

// fix: nearest valid, darker on a tie
assert.strictEqual(Tone.fix(3, 3), 5, 'tie between 1 and 5 goes darker');
assert.strictEqual(Tone.fix(7, 7), 5);
assert.strictEqual(Tone.fix(1, 0), 2);
assert.strictEqual(Tone.fix(4, 0), 4, 'already valid is kept');
assert.strictEqual(Tone.fix(99, 0), 7, 'clamped');

// auto default: two steps darker, two lighter at the bottom
assert.strictEqual(Tone.auto(0), 2);
assert.strictEqual(Tone.auto(5), 7);
assert.strictEqual(Tone.auto(6), 4);

// resolve over a small tree
const item = (id) => ({ role: 'item', kind: 'item', id, type: 'chip' });
const box = (id, kids, type) => ({ kind: type || 'card', type: type || 'card', id, kids });
const inner = box('in', [item('chip')]);
const top = box('top', [inner, item('direct')]);
const board = { views: [top], style: { ids: {} } };

let r = Tone.resolve(board, { auto: true });
assert.strictEqual(r.get(top).tone, 0, 'top-level starts at the lightest tone');
assert.strictEqual(r.get(inner).tone, 2);
assert.strictEqual(r.get(inner.kids[0]).tone, 4);
assert.strictEqual(r.get(top.kids[1]).tone, 2, 'item directly in the top box');
assert.strictEqual(r.get(inner).parent, 0);

// without auto, unset nodes keep the theme look
r = Tone.resolve(board, { auto: false });
assert.strictEqual(r.get(top).tone, null);
assert.strictEqual(r.get(inner).tone, null);

// explicit tones: top-level is free, nested ones are pushed apart
board.style.ids = { top: { tone: 4 }, in: { tone: 5 }, chip: { tone: 1 } };
r = Tone.resolve(board, { auto: true });
assert.strictEqual(r.get(top).tone, 4, 'top-level tone is taken as chosen');
assert.strictEqual(r.get(inner).tone, 6, 'tone 5 next to parent 4 moves to the nearest valid one');
assert.strictEqual(r.get(inner.kids[0]).tone, 1, 'a valid explicit tone is kept, in either direction');

// changing the parent re-checks the child
board.style.ids = { top: { tone: 1 }, in: { tone: 2 } };
r = Tone.resolve(board, { auto: true });
assert.strictEqual(r.get(inner).tone, 3, 'child at 2 under parent 1 moves to 3');

// transparent hosts do not count as a parent: their children are not constrained
const cont = box('c', [item('x')], 'container');
const board2 = { views: [cont], style: { ids: { x: { tone: 1 } } } };
r = Tone.resolve(board2, { auto: true });
assert.strictEqual(r.get(cont).tone, null);
assert.strictEqual(r.get(cont.kids[0]).tone, 1, 'item straight under a container is a top-level fill');
assert.strictEqual(r.get(cont.kids[0]).parent, null);

// notes keep their look and are never toned
const note = { role: 'item', kind: 'item', id: 'n', type: 'note' };
const board3 = { views: [box('b', [note])], style: { ids: { n: { tone: 3 } } } };
r = Tone.resolve(board3, { auto: true });
assert.strictEqual(r.get(note).tone, null);
console.log('ok tone');

// ---- hue: the outermost box decides the colour family of a ramp ----
{
  const Themes = require('../../../packages/board/themes');
  const a = { kind: 'card', type: 'card', id: 'a', kids: [{ kind: 'card', type: 'card', id: 'a1', kids: [{ role: 'item', kind: 'item', id: 'i1', type: 'chip' }] }] };
  const b = { kind: 'card', type: 'card', id: 'b', kids: [] };
  const r = Tone.resolve({ views: [a, b], style: {} }, { auto: false });
  assert.strictEqual(r.get(a).hue, 0, 'first outermost box');
  assert.strictEqual(r.get(a.kids[0]).hue, 0, 'a nested box shares its outermost box hue');
  assert.strictEqual(r.get(a.kids[0].kids[0]).hue, 0);
  assert.strictEqual(r.get(b).hue, 2, 'the counter also counts nested boxes, like the swatch rotation at mount');
  const rootItem = { role: 'item', kind: 'item', id: 'ri', type: 'chip' };
  assert.strictEqual(Tone.resolve({ views: [rootItem], style: {} }, {}).get(rootItem).hue, null);

  const pastel = Themes.get('pastel');
  const sw = pastel.swatches;
  const green = Themes.rampFor(pastel, 1);
  assert.strictEqual(green.length, 8);
  assert.strictEqual(green[0], sw[1].bg, 'step 0 is the box colour');
  assert.notStrictEqual(green[7], sw[1].bg);
  assert.deepStrictEqual(Themes.rampFor(pastel, 1), Themes.rampFor(pastel, 1 + sw.length), 'hue wraps like the swatches');
  assert.notDeepStrictEqual(Themes.rampFor(pastel, 0), Themes.rampFor(pastel, 1), 'different hues, different ramps');
  assert.deepStrictEqual(Themes.rampFor(Themes.get('classic'), 3), Themes.get('classic').ramp, 'other themes keep a fixed ramp');
}

// ---- autoBoxes: boxes follow the ramp by default, items keep the theme colours ----
{
  const item = { role: 'item', kind: 'item', id: 'c', type: 'chip' };
  const inner = { kind: 'card', type: 'card', id: 'in', kids: [item] };
  const top = { kind: 'card', type: 'card', id: 'top', kids: [inner] };
  const r = Tone.resolve({ views: [top], style: {} }, { autoBoxes: true });
  assert.strictEqual(r.get(top).tone, 0);
  assert.strictEqual(r.get(inner).tone, 2, 'a nested box defaults two steps deeper');
  assert.strictEqual(r.get(item).tone, null, 'items keep the theme colours');
  assert.strictEqual(require('../../../packages/board/themes').get('pastel').autoBoxTone, true);
}
