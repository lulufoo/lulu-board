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

console.log('ok cloud-route');
