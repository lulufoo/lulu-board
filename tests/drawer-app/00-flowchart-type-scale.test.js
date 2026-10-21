'use strict';
const assert = require('assert');
const Scale = require('../../packages/drawer-app/js/00-flowchart-type-scale.js');

assert.strictEqual(Scale.clampStep(0), 0);
assert.strictEqual(Scale.clampStep(1.4), 1);
assert.strictEqual(Scale.clampStep(-9), -3);
assert.strictEqual(Scale.clampStep(9), 3);
assert.strictEqual(Scale.clampStep('x'), 0);

assert.strictEqual(Scale.px('default', 0), 16);
assert.strictEqual(Scale.px('startEnd', 0), 15);
assert.strictEqual(Scale.px('judgment', 0), 14);
assert.strictEqual(Scale.px('link', 0), 13);

assert.strictEqual(Scale.px('default', 1), 18);
assert.strictEqual(Scale.px('startEnd', 1), 17);
assert.strictEqual(Scale.px('judgment', 1), 16);
assert.strictEqual(Scale.px('link', 1), 15);

assert.strictEqual(Scale.px('default', 2), 20);
assert.strictEqual(Scale.px('startEnd', 2), 19);
assert.strictEqual(Scale.px('judgment', 2), 18);
assert.strictEqual(Scale.px('link', 2), 16);

assert.strictEqual(Scale.px('default', 3), 23);
assert.strictEqual(Scale.px('startEnd', 3), 21);
assert.strictEqual(Scale.px('judgment', 3), 20);
assert.strictEqual(Scale.px('link', 3), 19);

assert.strictEqual(Scale.px('default', -1), 14);
assert.strictEqual(Scale.px('startEnd', -1), 13);
assert.strictEqual(Scale.px('judgment', -1), 12);
assert.strictEqual(Scale.px('link', -1), 12);

assert.strictEqual(Scale.px('default', -2), 13);
assert.strictEqual(Scale.px('startEnd', -2), 12);
assert.strictEqual(Scale.px('judgment', -2), 11);
assert.strictEqual(Scale.px('link', -2), 10);

assert.strictEqual(Scale.px('default', -3), 11);
assert.strictEqual(Scale.px('startEnd', -3), 11);
assert.strictEqual(Scale.px('judgment', -3), 10);
assert.strictEqual(Scale.px('link', -3), 9);

assert.ok(Scale.px('default', 0) > Scale.px('startEnd', 0));
assert.ok(Scale.px('startEnd', 0) > Scale.px('judgment', 0));
assert.ok(Scale.px('judgment', 0) > Scale.px('link', 0));
assert.ok(Scale.px('link', -3) >= Scale.MIN_PX);

console.log('ok flowchart-type-scale');
