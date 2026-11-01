import assert from 'node:assert';
import { resolveBackground } from '../../packages/board-core/style-token.js';
import { get } from '../../packages/board-themes/index.js';
import { APPEARANCES, DEFAULT_APPEARANCE, getAppearance, resolveAppearance } from '../../packages/board-themes/appearance/index.js';

assert.deepStrictEqual(APPEARANCES, { light: 1, dark: 1 });
assert.strictEqual(DEFAULT_APPEARANCE, 'light');
assert.strictEqual(resolveAppearance(''), 'light');
assert.strictEqual(resolveAppearance('dark'), 'dark');
assert.strictEqual(resolveAppearance('light'), 'light');

const KEYS = [
  'chrome', 'diagram', 'dock', 'ground', 'halo', 'id', 'note', 'page', 'source',
];
const light = getAppearance();
const dark = getAppearance('dark');
assert.strictEqual(light.id, 'light');
assert.strictEqual(dark.id, 'dark');
assert.strictEqual(getAppearance('nope').id, 'light');
assert.deepStrictEqual(Object.keys(light).sort(), KEYS);
assert.deepStrictEqual(Object.keys(dark).sort(), KEYS);
assert.deepStrictEqual(light.ground, { background: '#fff', dot: '#dfe7ea' });
assert.deepStrictEqual(dark.ground, { background: '#14110e', dot: '#3f3830' });
assert.deepStrictEqual(resolveBackground(), light.ground);
assert.deepStrictEqual(resolveBackground('dark'), dark.ground);
assert.notDeepStrictEqual(dark.diagram.colors, light.diagram.colors);
assert.strictEqual(get('default').colors[0], light.diagram.colors[0]);
assert.strictEqual(get('default').color, light.diagram.color);
assert.strictEqual(get('light').id, 'light');
assert.strictEqual(get('dark').id, 'dark');
assert.strictEqual(get('dark').color, dark.diagram.color);
assert.deepStrictEqual(get('dark').colors, dark.diagram.colors);

console.log('ok board-themes appearance');
