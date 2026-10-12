'use strict';
const assert = require('assert');
global.BoardThemes = require('../../../packages/board/themes');
const R = require('../../../packages/board/engine/board-render.js');

const src = [
  'board "t"',
  'box TOP "Top"',
  '  box MID "Mid"',
  '    item "leaf"',
  '',
].join('\n');

// pick a tone on the top box, then on its child: a close pick is moved apart and written back to the source
let s = R.updateNodeTone(src, 'TOP', 3);
assert.strictEqual(R.parse(s).style.ids.TOP.tone, 3);
s = R.updateNodeTone(s, 'MID', 4);
assert.strictEqual(R.parse(s).style.ids.MID.tone, 5, 'MID 4 is next to TOP 3 and moves to 5');

// changing the parent later re-settles the child
s = R.updateNodeTone(s, 'TOP', 5);
assert.strictEqual(R.parse(s).style.ids.MID.tone, 7, 'MID 5 under TOP 5 moves to 7 (3 and 7 tie, the darker wins)');

// picker state
const board = R.parse(s);
const info = R.nodeToneInfo(board, { kind: 'box', id: 'MID' });
assert.strictEqual(info.fillable, true);
assert.strictEqual(info.parent, 5);
assert.deepStrictEqual(info.allowed, [true, true, true, true, false, false, false, true]);
assert.strictEqual(info.ramp.length, 8);
assert.strictEqual(R.nodeToneInfo(board, { kind: 'box', id: 'TOP' }).parent, null, 'top-level has no constraint');

// Auto clears the pick; an item without an id gets one only when a tone is picked
s = R.updateNodeTone(s, 'MID', null);
assert.strictEqual(R.parse(s).style.ids.MID, undefined);
const picked = R.updateNodeTone(src, { kind: 'item', key: 'item:MID:0', boxId: 'MID', index: 0 }, 6);
assert.match(picked, /box MID|item /, 'source still parses');
assert.ok(Object.values(R.parse(picked).style.ids).some((row) => row.tone === 6), 'the item got an id and its tone');

// the tone survives a round trip through the source
assert.strictEqual(R.serialize(R.parse(s)), s);
console.log('ok tone-source');
