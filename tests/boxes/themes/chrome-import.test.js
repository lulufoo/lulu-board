import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const { kitFor, applyTo } = require('../../../packages/boxes/themes');
const { ring } = require('../../../packages/board-themes');

assert.strictEqual(typeof kitFor, 'function');
assert.strictEqual(typeof applyTo, 'function');
assert.ok(kitFor('default', 'card').cardBg);

const el = {
  style: { map: {}, setProperty: function (k, v) { this.map[k] = v; } },
  dataset: {},
};
applyTo(el, 'default');
assert.strictEqual(el.style.map['--bf-ring'], ring.color);
assert.strictEqual(el.style.map['--bf-ring-soft'], ring.hover);
assert.strictEqual(el.style.map['--canvas-ring'], ring.color);
assert.strictEqual(el.style.map['--canvas-ring-width'], ring.width + 'px');
assert.strictEqual(el.style.map['--canvas-ring-offset'], ring.offset + 'px');
assert.strictEqual(el.dataset.boardTheme, 'default');
console.log('ok chrome-import');
