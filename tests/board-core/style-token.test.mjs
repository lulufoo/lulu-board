import assert from 'node:assert';
import {
  authoredFields,
  clampStep,
  clampTypeStep,
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

console.log('ok board-core style-token');
