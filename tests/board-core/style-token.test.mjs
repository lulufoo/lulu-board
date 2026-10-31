import assert from 'node:assert';
import {
  authoredFields,
  clampStep,
  clampTypeStep,
  DEFAULTS,
  leftoverFields,
  resolveBackground,
  resolveFields,
  resolveThemeId,
  STEP_MAX,
  STEP_MIN,
} from '../../packages/board-core/style-token.js';

assert.strictEqual(resolveThemeId('minimal'), 'classic');
assert.strictEqual(resolveThemeId('slate'), 'pastel');
assert.strictEqual(resolveThemeId('kami'), 'default');
assert.strictEqual(resolveThemeId('classic'), 'classic');
assert.strictEqual(resolveThemeId(''), 'default');
assert.deepStrictEqual(authoredFields({ theme: 'slate' }), { theme: 'pastel' });
assert.deepStrictEqual(authoredFields({ theme: 'kami' }), {});
assert.strictEqual(clampTypeStep(99), STEP_MAX);
assert.strictEqual(clampStep(-99), STEP_MIN);
assert.strictEqual(clampTypeStep('x'), 0);
assert.strictEqual(resolveBackground('dusk'), 'dusk');
assert.strictEqual(resolveBackground('nope'), 'paper');
assert.strictEqual(resolveBackground(''), 'paper');
assert.strictEqual(resolveFields({}).background, 'paper');
assert.deepStrictEqual(resolveFields({}), DEFAULTS);
assert.deepStrictEqual(authoredFields({}), {});
assert.deepStrictEqual(authoredFields({ background: 'paper' }), {});
assert.deepStrictEqual(authoredFields({ background: 'dusk' }), { background: 'dusk' });
assert.deepStrictEqual(authoredFields({ background: 'nope' }), {});
assert.strictEqual(resolveFields({ type_step: 3 }).font_size, 0);
assert.deepStrictEqual(authoredFields({ type_step: 3 }), {});
assert.deepStrictEqual(leftoverFields({ type_step: 3, theme: 'pastel' }), { type_step: 3 });
assert.deepStrictEqual(authoredFields({ font_size: 2 }), { font_size: 2 });
assert.strictEqual(resolveFields({ font_size: 2 }).font_size, 2);
assert.deepStrictEqual(authoredFields({ font_size: 0 }), {});
assert.deepStrictEqual(authoredFields({ max_width: 2 }), { max_width: 2 });
assert.deepStrictEqual(authoredFields({ max_width: 0 }), {});
assert.strictEqual(resolveFields({}).max_width, 0);
assert.strictEqual(resolveFields({ item_cap: 24 }).max_width, 0);
assert.deepStrictEqual(leftoverFields({ item_cap: 24, theme: 'pastel' }), { item_cap: 24 });

console.log('ok board-core style-token');
