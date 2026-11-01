import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const assert = require('assert');
const Session = require('../../packages/drawer-app/src/core/session-appearance.js').default;

assert.strictEqual(Session.getSessionAppearance(), 'light');
assert.strictEqual(Session.setSessionAppearance('dark'), 'dark');
assert.strictEqual(Session.getSessionAppearance(), 'dark');
assert.strictEqual(Session.setSessionAppearance('classic'), 'light');
assert.strictEqual(Session.getSessionAppearance(), 'light');
assert.strictEqual(Session.setSessionAppearance(''), 'light');

console.log('ok session-appearance');
