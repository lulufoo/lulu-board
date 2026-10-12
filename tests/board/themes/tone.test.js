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
