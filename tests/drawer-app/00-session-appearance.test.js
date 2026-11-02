import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Session = require('../../packages/drawer-app/src/core/session-appearance.js').default;

assert.strictEqual(Session.APPEARANCE_COOKIE, 'drawer.appearance');
assert.strictEqual(Session.getSessionAppearance(), 'light');
assert.strictEqual(Session.setSessionAppearance('dark'), 'dark');
assert.strictEqual(Session.getSessionAppearance(), 'dark');
assert.strictEqual(Session.setSessionAppearance('classic'), 'light');
assert.strictEqual(Session.getSessionAppearance(), 'light');
assert.strictEqual(Session.setSessionAppearance(''), 'light');

assert.strictEqual(Session.readAppearanceCookie(''), 'light');
assert.strictEqual(Session.readAppearanceCookie('drawer.appearance=dark'), 'dark');
assert.strictEqual(Session.readAppearanceCookie('foo=1; drawer.appearance=dark; bar=2'), 'dark');
assert.strictEqual(Session.readAppearanceCookie('drawer.appearance=classic'), 'light');
assert.strictEqual(Session.readAppearanceCookie('drawer.appearance=dark; other=1; drawer.appearance=light'), 'light');
assert.strictEqual(Session.readAppearanceCookie('drawer.ui=%7B%7D; drawer.appearance=dark'), 'dark');

{
  const line = Session.writeAppearanceCookie('dark');
  assert.match(line, /^drawer\.appearance=dark; Path=\/; SameSite=Lax; Max-Age=31536000/);
  assert.doesNotMatch(line, /Domain=/);
  assert.doesNotMatch(Session.writeAppearanceCookie('classic'), /classic/);
  assert.match(Session.writeAppearanceCookie('classic'), /^drawer\.appearance=light;/);
}

{
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../packages/drawer-app/src/core/session-appearance.js'), 'utf8');
  assert.match(src, /document\.cookie/, 'session appearance reads and writes a cookie');
  assert.doesNotMatch(src, /localStorage/, 'appearance is not a localStorage key');
}

console.log('ok session-appearance');
