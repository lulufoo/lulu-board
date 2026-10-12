'use strict';
const assert = require('assert');
const Tone = require('../../../packages/board/themes/tone');

// auto default: two steps darker, two lighter at the bottom of the ramp
assert.strictEqual(Tone.auto(0), 2);
assert.strictEqual(Tone.auto(5), 7);
assert.strictEqual(Tone.auto(6), 4);
assert.strictEqual(Tone.auto(7), 5);

// no manual picker: the module exposes the automatic rule only
['ok', 'fix', 'allowed', 'clamp', 'explicitOf'].forEach((name) => assert.strictEqual(Tone[name], undefined, name + ' is gone'));

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
assert.strictEqual(r.get(top).parent, null);

// a stored tone in an old board is ignored: colours come from the rule only
board.style.ids = { top: { tone: 4 }, in: { tone: 5 }, chip: { tone: 1 } };
r = Tone.resolve(board, { auto: true });
assert.strictEqual(r.get(top).tone, 0);
assert.strictEqual(r.get(inner).tone, 2);
assert.strictEqual(r.get(inner.kids[0]).tone, 4);

// without auto, nodes keep the theme look
r = Tone.resolve(board, { auto: false });
assert.strictEqual(r.get(top).tone, null);
assert.strictEqual(r.get(inner).tone, null);

// transparent hosts are skipped: children are compared with the nearest filled ancestor (none here)
const cont = box('c', [item('x')], 'container');
r = Tone.resolve({ views: [cont], style: { ids: {} } }, { auto: true });
assert.strictEqual(r.get(cont).tone, null);
assert.strictEqual(r.get(cont.kids[0]).parent, null);

// notes keep their look and are never toned
const note = { role: 'item', kind: 'item', id: 'n', type: 'note' };
r = Tone.resolve({ views: [box('b', [note])], style: { ids: {} } }, { auto: true });
assert.strictEqual(r.get(note).tone, null);

// paint: only nested nodes are painted
const el = () => ({ dataset: {}, style: { props: {}, setProperty(k, v, p) { this.props[k] = v + (p ? '!' : ''); } } });
const ramp = ['#0', '#1', '#2', '#3', '#4', '#5', '#6', '#7'];
let a = el(); Tone.paint(a, ramp, { tone: 0, parent: null }, false);
assert.deepStrictEqual(a.style.props, {}, 'top-level keeps the theme look');
a = el(); Tone.paint(a, ramp, { tone: 2, parent: 0 }, false);
assert.strictEqual(a.style.props.background, '#2!');
assert.strictEqual(a.dataset.bfTone, '2');
a = el(); Tone.paint(a, ramp, { tone: 2, parent: 0 }, true);
assert.strictEqual(a.style.props['--bf-tone-fill'], '#2');
console.log('ok tone');
