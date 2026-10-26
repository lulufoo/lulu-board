import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');

global.window = global;
global.location = { pathname: '/landing' };

const sentry = require('../../packages/drawer-app/src/core/sentry-count.js');
const hooks = require('../../packages/drawer-app/src/core/hooks.js');
const sentryCount = sentry.sentryCount;
const { register, emit, call, clear } = hooks;

assert.strictEqual(typeof sentryCount, 'function');
assert.doesNotThrow(() => sentryCount('canvas.view'));

let seen = null;
const off = register('probe', (value) => { seen = value; });
emit('probe', 7);
assert.strictEqual(seen, 7);
off();
seen = null;
emit('probe', 8);
assert.strictEqual(seen, null);
clear();

register('sum', (a, b) => a + b);
assert.strictEqual(call('sum', 2, 3), 5);
clear();

console.log('ok src-entry');
