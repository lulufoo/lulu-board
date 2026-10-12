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

assert.strictEqual(Scale.stepFromStyle({ ids: { HERO: { fz: 2 } } }, 'HERO'), 2);
assert.strictEqual(Scale.stepFromStyle({ ids: { HERO: { fz: 2 } } }, 'LEAF'), null);
assert.strictEqual(Scale.stepFromStyle({}, 'HERO'), null);
const itemEl = { style: { map: {}, setProperty: function (k, v) { this.map[k] = v; } } };
Scale.applyItemStep(itemEl, 1);
assert.strictEqual(itemEl.style.map['--board-card-size'], '14px');
const boxEl = { style: { map: {}, setProperty: function (k, v) { this.map[k] = v; } } };
Scale.applyBoxTitleStep(boxEl, 'card', 1);
assert.strictEqual(boxEl.style.map['--board-title-size'], '15px');
assert.ok(!boxEl.style.map['--board-card-size'], 'box override does not set item size');

console.log('ok type-scale');

// link titles sit one rung below body text and follow the same step ladder
assert.strictEqual(Scale.px('label', 0), 11);
assert.strictEqual(Scale.sizeForLabel(0), '11px');
assert.strictEqual(Scale.sizes(0).label, '11px');
assert.ok(Scale.px('label', 1) > Scale.px('label', 0));
