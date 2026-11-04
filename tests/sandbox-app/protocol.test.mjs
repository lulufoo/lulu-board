import assert from 'node:assert/strict';
import {
  SANDBOX_MSG,
  SANDBOX_MAX_EDGE,
  SANDBOX_BLEED,
  renderMessage,
  appearanceMessage,
  captureMessage,
  readyMessage,
  sizeMessage,
  capturedMessage,
  errorMessage,
  parseRender,
  parseAppearance,
  parseCapture,
  parseReady,
  parseSize,
  parseCaptured,
  parseError,
  SANDBOX_MAX_TEXT,
  SANDBOX_TARGET_ATTR,
  SANDBOX_SELECTED_ATTR,
  isSketchTarget,
  splitSketchText,
  pickMessage,
  pickedMessage,
  selectMessage,
  textMessage,
  parsePick,
  parsePicked,
  parseSelect,
  parseText,
} from '../../packages/sandbox-app/src/protocol.js';

assert.deepEqual(parseRender(renderMessage('<p>x</p>')), { html: '<p>x</p>', appearance: 'light' });
assert.deepEqual(parseRender(renderMessage('<p>x</p>', 'dark')), { html: '<p>x</p>', appearance: 'dark' });
assert.deepEqual(parseRender(renderMessage('<p>x</p>', 'nope')), { html: '<p>x</p>', appearance: 'light' }, 'unknown appearance is light');
assert.deepEqual(parseRender({ type: SANDBOX_MSG.RENDER, html: '<p>x</p>' }), { html: '<p>x</p>', appearance: 'light' }, 'a missing appearance is light');
assert.equal(parseRender({ type: SANDBOX_MSG.RENDER, html: 1 }), null, 'html must be a string');
assert.equal(parseRender(null), null);
assert.equal(parseRender({ type: 'other', html: '' }), null);
assert.deepEqual(parseAppearance(appearanceMessage('dark')), { appearance: 'dark' });
assert.equal(parseAppearance({ type: SANDBOX_MSG.APPEARANCE, appearance: 'nope' }), null, 'an invalid appearance is not a message');
assert.equal(parseAppearance({ type: SANDBOX_MSG.APPEARANCE }), null);

assert.deepEqual(parseCapture(captureMessage('a1', 2)), { id: 'a1', scale: 2 });
for (const bad of [
  captureMessage('', 2),
  captureMessage('x'.repeat(65), 2),
  captureMessage('a', 0),
  captureMessage('a', -1),
  captureMessage('a', 9),
  captureMessage('a', NaN),
  captureMessage('a', '2'),
  captureMessage(7, 2),
]) {
  assert.equal(parseCapture(bad), null, JSON.stringify(bad));
}

assert.deepEqual(parseReady(readyMessage()), {});
assert.equal(parseReady({ type: 'x' }), null);

assert.equal(SANDBOX_BLEED, 12, 'the runner keeps 12px on every side');
assert.deepEqual(parseSize(sizeMessage(100.2, 50)), { width: 101, height: 50, bleed: 0 }, 'no bleed means the frame is the picture');
assert.deepEqual(parseSize(sizeMessage(124, 74, 12)), { width: 124, height: 74, bleed: 12 });
assert.deepEqual(parseSize({ type: SANDBOX_MSG.SIZE, width: 100, height: 50 }), { width: 100, height: 50, bleed: 0 }, 'an older runner sends no bleed');
for (const badBleed of [-1, 0.5, 13, '12', NaN, Infinity, null, 25]) {
  assert.equal(parseSize({ type: SANDBOX_MSG.SIZE, width: 200, height: 200, bleed: badBleed }).bleed, 0, `bleed ${String(badBleed)} is dropped`);
}
assert.equal(parseSize(sizeMessage(24, 100, 12)).bleed, 0, 'a bleed that leaves no picture is dropped');
assert.equal(parseSize(sizeMessage(100, 24, 12)).bleed, 0, 'a bleed that leaves no picture is dropped');
for (const bad of [
  sizeMessage(0, 10),
  sizeMessage(10, -1),
  sizeMessage(SANDBOX_MAX_EDGE + 1, 10),
  sizeMessage(Infinity, 10),
  sizeMessage('10', 10),
  sizeMessage(NaN, 10),
]) {
  assert.equal(parseSize(bad), null, JSON.stringify(bad));
}

const bitmap = { width: 10, height: 20 };
assert.deepEqual(parseCaptured(capturedMessage('a', bitmap)), { id: 'a', bitmap });
assert.equal(parseCaptured(capturedMessage('a', null)), null);
assert.equal(parseCaptured(capturedMessage('a', { width: 0, height: 1 })), null);
assert.equal(parseCaptured(capturedMessage('', bitmap)), null);

assert.deepEqual(parseError(errorMessage('a', 'boom')), { id: 'a', message: 'boom' });
assert.equal(parseError(errorMessage('', 'boom')).id, null, 'bad id degrades to null');
assert.equal(parseError(errorMessage('a', 'x'.repeat(500))).message.length, 200);
assert.equal(parseError({ type: 'x' }), null);

// Picking text: a target id is an element-index path and nothing else, because the runner puts it in a selector.
assert.equal(SANDBOX_TARGET_ATTR, 'data-lulu-id');
assert.equal(SANDBOX_SELECTED_ATTR, 'data-lulu-selected');
for (const good of ['0', '12', '1.0.3', '0.0.0.0.0', '999999.999999']) assert.equal(isSketchTarget(good), true, good);
for (const bad of ['', '.', '1.', '.1', '1..2', 'a', '1.a', '-1', '1e3', '1 2', '1"]', '1.0; x', '0'.repeat(7), '1.'.repeat(40) + '1', 12, null, undefined, {}]) {
  assert.equal(isSketchTarget(bad), false, JSON.stringify(bad));
}

assert.deepEqual(parsePick(pickMessage('p1', 10.5, -3)), { id: 'p1', x: 10.5, y: -3 }, 'a point may sit in the bleed, left of the picture');
for (const bad of [
  pickMessage('', 1, 1),
  pickMessage('x'.repeat(65), 1, 1),
  pickMessage('p', NaN, 1),
  pickMessage('p', 1, Infinity),
  pickMessage('p', '1', 1),
  pickMessage('p', SANDBOX_MAX_EDGE + 1, 1),
  pickMessage('p', 1, -SANDBOX_MAX_EDGE - 1),
  { type: SANDBOX_MSG.PICK, id: 'p', x: 1 },
]) {
  assert.equal(parsePick(bad), null, JSON.stringify(bad));
}
assert.equal(parsePick({ type: 'x', id: 'p', x: 1, y: 1 }), null);

assert.deepEqual(parsePicked(pickedMessage('p1', '1.0')), { id: 'p1', target: '1.0' });
assert.deepEqual(parsePicked(pickedMessage('p1', null)), { id: 'p1', target: null }, 'no text there');
assert.deepEqual(parsePicked(pickedMessage('p1', '1" x')), { id: 'p1', target: null }, 'a fragment script that lies about the id is a miss');
assert.deepEqual(parsePicked({ type: SANDBOX_MSG.PICKED, id: 'p1', target: 5 }), { id: 'p1', target: null });
assert.deepEqual(parsePicked({ type: SANDBOX_MSG.PICKED, id: 'p1' }), { id: 'p1', target: null }, 'a missing target is a miss');
assert.equal(parsePicked(pickedMessage('', '1')), null, 'the request id must be valid');
assert.equal(parsePicked({ type: 'x', id: 'p1', target: '1' }), null);

const RING = { color: '#db4c84', width: 2, offset: 2 };
assert.deepEqual(parseSelect(selectMessage('1.0', RING)), { target: '1.0', ring: RING });
assert.deepEqual(parseSelect(selectMessage(null, null)), { target: null, ring: null }, 'null target clears the selection');
assert.deepEqual(parseSelect(selectMessage(null, { color: 'junk' })), { target: null, ring: null }, 'a clear needs no ring');
assert.deepEqual(parseSelect(selectMessage('1.0', { color: '#ABCDEF', width: 0, offset: 16 })).ring, { color: '#ABCDEF', width: 0, offset: 16 });
for (const bad of [
  selectMessage('1.0', null),
  selectMessage('1.0', undefined),
  selectMessage('1.0', { color: 'red', width: 2, offset: 2 }),
  selectMessage('1.0', { color: '#db4c8', width: 2, offset: 2 }),
  selectMessage('1.0', { color: '#db4c84; x:y', width: 2, offset: 2 }),
  selectMessage('1.0', { color: '#db4c84', width: -1, offset: 2 }),
  selectMessage('1.0', { color: '#db4c84', width: 2, offset: 17 }),
  selectMessage('1.0', { color: '#db4c84', width: '2', offset: 2 }),
  selectMessage('1.0', { color: '#db4c84', width: NaN, offset: 2 }),
  selectMessage('1" x', RING),
  selectMessage(undefined, RING),
  selectMessage(7, RING),
]) {
  assert.equal(parseSelect(bad), null, JSON.stringify(bad));
}
assert.equal(parseSelect({ type: 'x', target: null }), null);

assert.deepEqual(parseText(textMessage('1.0', 'a\nb')), { target: '1.0', text: 'a\nb' });
assert.deepEqual(parseText(textMessage('1.0', '')), { target: '1.0', text: '' }, 'empty text is a valid edit');
assert.equal(parseText(textMessage('1.0', 'x'.repeat(SANDBOX_MAX_TEXT))).text.length, SANDBOX_MAX_TEXT);
for (const bad of [
  textMessage('1.0', 'x'.repeat(SANDBOX_MAX_TEXT + 1)),
  textMessage('1.0', 5),
  textMessage('1.0', null),
  textMessage('1.0', undefined),
  textMessage('', 'x'),
  textMessage('1" x', 'x'),
  textMessage(null, 'x'),
]) {
  assert.equal(parseText(bad), null, JSON.stringify(bad));
}
assert.equal(parseText({ type: 'x', target: '1', text: 'a' }), null);

assert.deepEqual(splitSketchText('a\nb\r\nc\rd'), ['a', 'b', 'c', 'd'], 'every line ending is one break');
assert.deepEqual(splitSketchText(''), ['']);
assert.deepEqual(splitSketchText('\n'), ['', '']);
assert.deepEqual(splitSketchText(null), ['']);

console.log('ok sandbox protocol');
