import assert from 'node:assert/strict';
import {
  SANDBOX_MSG,
  SANDBOX_MAX_EDGE,
  SANDBOX_BLEED,
  renderMessage,
  appearanceMessage,
  modeMessage,
  captureMessage,
  readyMessage,
  sizeMessage,
  capturedMessage,
  errorMessage,
  parseRender,
  parseAppearance,
  parseMode,
  parseCapture,
  parseReady,
  parseSize,
  parseCaptured,
  parseError,
} from '../../packages/sandbox-app/src/protocol.js';

assert.deepEqual(parseRender(renderMessage('<p>x</p>')), { html: '<p>x</p>', appearance: 'light', mode: 'canvas' });
assert.deepEqual(parseRender(renderMessage('<p>x</p>', 'dark')), { html: '<p>x</p>', appearance: 'dark', mode: 'canvas' });
assert.deepEqual(parseRender(renderMessage('<p>x</p>', 'nope')), { html: '<p>x</p>', appearance: 'light', mode: 'canvas' }, 'unknown appearance is light');
assert.deepEqual(parseRender({ type: SANDBOX_MSG.RENDER, html: '<p>x</p>' }), { html: '<p>x</p>', appearance: 'light', mode: 'canvas' }, 'a missing appearance is light, and a missing mode is canvas');
assert.equal(parseRender(renderMessage('<p>x</p>', 'light', 'present')).mode, 'present', 'the render carries the mode the user is in');
assert.equal(parseRender(renderMessage('<p>x</p>', 'light', 'nope')).mode, 'canvas', 'an unknown mode is canvas');
assert.equal(parseRender({ type: SANDBOX_MSG.RENDER, html: '', mode: 1 }).mode, 'canvas', 'a mode that is not a string is canvas');
assert.equal(parseRender({ type: SANDBOX_MSG.RENDER, html: 1 }), null, 'html must be a string');
assert.equal(parseRender(null), null);
assert.equal(parseRender({ type: 'other', html: '' }), null);
assert.deepEqual(parseAppearance(appearanceMessage('dark')), { appearance: 'dark' });
assert.equal(parseAppearance({ type: SANDBOX_MSG.APPEARANCE, appearance: 'nope' }), null, 'an invalid appearance is not a message');
assert.equal(parseAppearance({ type: SANDBOX_MSG.APPEARANCE }), null);
assert.equal(SANDBOX_MSG.MODE, 'lulu-sandbox:mode');
assert.deepEqual(parseMode(modeMessage('present')), { mode: 'present' });
assert.deepEqual(parseMode(modeMessage('canvas')), { mode: 'canvas' });
assert.equal(parseMode({ type: SANDBOX_MSG.MODE, mode: 'nope' }), null, 'an invalid mode is not a message');
assert.equal(parseMode({ type: SANDBOX_MSG.MODE }), null);
assert.equal(parseMode({ type: SANDBOX_MSG.APPEARANCE, mode: 'present' }), null, 'only a mode message carries a mode');
assert.equal(parseMode(null), null);

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

console.log('ok sandbox protocol');
