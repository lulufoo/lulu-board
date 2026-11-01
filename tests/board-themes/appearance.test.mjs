import assert from 'node:assert';
import { resolveBackground } from '../../packages/board-core/style-token.js';
import { get } from '../../packages/board-themes/index.js';
import { APPEARANCES, DEFAULT_APPEARANCE, getAppearance, resolveAppearance } from '../../packages/board-themes/appearance/index.js';

assert.deepStrictEqual(APPEARANCES, { light: 1, dark: 1 });
assert.strictEqual(DEFAULT_APPEARANCE, 'light');
assert.strictEqual(resolveAppearance(''), 'light');
assert.strictEqual(resolveAppearance('dark'), 'dark');
assert.strictEqual(resolveAppearance('light'), 'light');

const table = getAppearance();
assert.strictEqual(table.id, 'light');
assert.strictEqual(getAppearance('nope').id, 'light');
assert.deepStrictEqual(Object.keys(table).sort(), [
  'chrome', 'diagram', 'dock', 'ground', 'halo', 'id', 'note', 'page', 'source',
]);
assert.deepStrictEqual(table.ground, { background: '#fff', dot: '#dfe7ea' });
assert.deepStrictEqual(resolveBackground(), table.ground);
assert.deepStrictEqual(resolveBackground('dark'), table.ground, 'Dark table is not hung yet');
assert.strictEqual(get('default').colors[0], table.diagram.colors[0]);
assert.strictEqual(get('default').color, table.diagram.color);

console.log('ok board-themes appearance');
