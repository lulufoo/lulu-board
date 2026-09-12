'use strict';
const assert = require('assert');
const Scale = require('../../../packages/board/themes/type-scale');

assert.strictEqual(Scale.clampStep(0), 0);
assert.strictEqual(Scale.clampStep(1.4), 1);
assert.strictEqual(Scale.clampStep(-9), -3);
assert.strictEqual(Scale.clampStep(9), 3);
assert.strictEqual(Scale.clampStep('x'), 0);

assert.strictEqual(Scale.px('body', 0), 12);
assert.strictEqual(Scale.px('title', 0), 13);
assert.strictEqual(Scale.px('body', 1), 14);
assert.strictEqual(Scale.px('title', 1), 15);
assert.strictEqual(Scale.px('body', 2), 15);
assert.strictEqual(Scale.px('title', 2), 16);
assert.strictEqual(Scale.px('body', 3), 17);
assert.strictEqual(Scale.px('title', 3), 19);
assert.strictEqual(Scale.px('body', -1), 11);
assert.strictEqual(Scale.px('title', -1), 12);
assert.strictEqual(Scale.px('body', -2), 9);
assert.strictEqual(Scale.px('title', -2), 10);
assert.strictEqual(Scale.px('body', -3), 8);
assert.strictEqual(Scale.px('title', -3), 9);
assert.strictEqual(Scale.px('caption', -3), 8);
assert.strictEqual(Scale.sizeForCard(1), '14px');
assert.strictEqual(Scale.sizeForTitle('card', 1), '15px');
assert.strictEqual(Scale.sizes(0).display, '24px');

console.log('ok type-scale');
