'use strict';
const assert = require('assert');
const Rotation = require('../../../packages/boxes/themes/rotation');

const item = (id, type) => ({ role: 'item', kind: 'item', id, type: type || 'chip' });
const box = (id, kids, type) => ({ kind: type || 'card', type: type || 'card', id, kids });
const colors = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
const run = (views) => Rotation.resolve({ views }, colors);

// parent x blocks x-1, x, x+1 (linear, no wrap-around)
assert.deepStrictEqual(Rotation.listAllowed(8, null), [0, 1, 2, 3, 4, 5, 6, 7]);
assert.deepStrictEqual(Rotation.listAllowed(8, 0), [2, 3, 4, 5, 6, 7]);
assert.deepStrictEqual(Rotation.listAllowed(8, 3), [0, 1, 5, 6, 7]);
assert.deepStrictEqual(Rotation.listAllowed(8, 7), [0, 1, 2, 3, 4, 5]);

// top-level boxes are one group counting from 0, then rotate
const tops = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => box('t' + i, []));
let r = run(tops);
assert.deepStrictEqual(tops.map((t) => r.get(t).idx), [0, 1, 2, 3, 4, 5, 6, 7, 0, 1]);
assert.strictEqual(r.get(tops[2]).color, 'c2');

// siblings of one parent take the allowed colours one by one; children of different parents count separately
const a1 = box('a1', []); const a2 = box('a2', []); const a3 = box('a3', []);
const a = box('a', [a1, a2, a3]);
const b1 = box('b1', []);
const b = box('b', [b1]);
r = run([a, b]);
assert.strictEqual(r.get(a).idx, 0);
assert.deepStrictEqual([a1, a2, a3].map((n) => r.get(n).idx), [2, 3, 4], 'under parent 0: 0 and 1 are blocked');
assert.strictEqual(r.get(b).idx, 1);
assert.strictEqual(r.get(b1).idx, 3, 'under parent 1: 0, 1, 2 are blocked; counter restarts');

// parent and child are always at least 2 apart, items and boxes alike, at every depth
const deep = box('d0', [item('i0'), box('d1', [item('i1'), box('d2', [item('i2'), item('i3')])])]);
r = run([deep]);
(function check(node, parentIdx) {
  const idx = r.get(node).idx;
  if (parentIdx != null) assert.ok(Math.abs(idx - parentIdx) >= 2, node.id + ' keeps the gap from its parent');
  (node.kids || []).forEach((k) => check(k, idx));
})(deep, null);

// items count with boxes in the same sibling group
const mixed = box('m', [item('x'), box('y', []), item('z')]);
r = run([mixed]);
assert.deepStrictEqual(mixed.kids.map((n) => r.get(n).idx), [2, 3, 4]);

// container / layout are transparent: no index, children start a fresh group with no parent
const inside = [item('p'), item('q')];
const cont = box('c', inside, 'container');
const outer = box('o', [cont, box('o2', [])]);
r = run([outer]);
assert.strictEqual(r.get(outer).idx, 0);
assert.strictEqual(r.has(cont), false, 'container has no colour');
assert.deepStrictEqual(inside.map((n) => r.get(n).idx), [0, 1], 'under a container: no parent, may match the outer box');
assert.strictEqual(r.get(outer.kids[1]).idx, 2, 'the container did not take a sibling slot');
const lay = box('l', [box('lb', [])], 'layout');
assert.strictEqual(run([lay]).get(lay.kids[0]).idx, 0);

// notes keep their look
const note = item('n', 'note');
assert.strictEqual(run([box('b', [note])]).has(note), false);

// a short list still gives a colour (gap cannot always hold)
const short = Rotation.resolve({ views: [box('s', [box('s1', [])])] }, ['only']);
assert.strictEqual(short.size, 2);

// paint: rect fills inline, diamond through a variable
const el = () => ({ dataset: {}, style: { props: {}, setProperty(k, v, p) { this.props[k] = v + (p ? '!' : ''); } } });
let e = el(); Rotation.paint(e, { idx: 2, color: '#abc' }, false);
assert.strictEqual(e.style.props.background, '#abc!');
assert.strictEqual(e.dataset.bfFill, '2');
e = el(); Rotation.paint(e, { idx: 2, color: '#abc' }, true);
assert.strictEqual(e.style.props['--bf-fill'], '#abc');
e = el(); Rotation.paint(e, undefined, false);
assert.deepStrictEqual(e.style.props, {}, 'a node without a colour is left alone');
console.log('ok rotation');
