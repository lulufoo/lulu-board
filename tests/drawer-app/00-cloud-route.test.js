'use strict';
const assert = require('assert');
const Route = require('../../packages/drawer-app/js/00-cloud-route.js');

assert.strictEqual(Route.cloudBoardIdFromHash('#b:b_29b9c39c'), 'b_29b9c39c');
assert.strictEqual(Route.cloudBoardIdFromHash('b:b_29b9c39c'), 'b_29b9c39c');
assert.strictEqual(Route.cloudBoardIdFromHash('#z:anything'), '');
assert.strictEqual(Route.cloudBoardIdFromHash('#b:b_29B9c39c'), '');
assert.strictEqual(Route.cloudBoardIdFromHash('#b:b_29b9c39'), '');
assert.strictEqual(Route.cloudBoardHash('b_29b9c39c'), '#b:b_29b9c39c');
assert.throws(() => Route.cloudBoardHash('wrong'), /invalid cloud board id/);

assert.strictEqual(Route.cloudShareIdFromHash('#s:s_0123456789abcdef0123456789abcdef'), 's_0123456789abcdef0123456789abcdef');
assert.strictEqual(Route.cloudShareIdFromHash('s:s_0123456789abcdef0123456789abcdef'), 's_0123456789abcdef0123456789abcdef');
assert.strictEqual(Route.cloudShareIdFromHash('#b:b_29b9c39c'), '');
assert.strictEqual(Route.cloudShareIdFromHash('#z:anything'), '');
assert.strictEqual(Route.cloudShareIdFromHash('#s:s_0123456789ABCDEF0123456789abcdef'), '');
assert.strictEqual(Route.cloudShareIdFromHash('#s:s_0123456789abcdef0123456789abcde'), '');
assert.strictEqual(Route.cloudShareHash('s_0123456789abcdef0123456789abcdef'), '#s:s_0123456789abcdef0123456789abcdef');
assert.throws(() => Route.cloudShareHash('s_short'), /invalid share id/);

console.log('ok cloud-route');
