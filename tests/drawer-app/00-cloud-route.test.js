'use strict';
const assert = require('assert');
const Route = require('../../packages/drawer-app/js/00-cloud-route.js');

assert.strictEqual(Route.cloudDiagramIdFromHash('#b:b_29b9c39c'), 'b_29b9c39c');
assert.strictEqual(Route.cloudDiagramIdFromHash('b:b_29b9c39c'), 'b_29b9c39c');
assert.strictEqual(Route.cloudDiagramIdFromHash('#z:anything'), '');
assert.strictEqual(Route.cloudDiagramIdFromHash('#b:b_29B9c39c'), '');
assert.strictEqual(Route.cloudDiagramIdFromHash('#b:b_29b9c39'), '');
assert.strictEqual(Route.cloudDiagramHash('b_29b9c39c'), '#b:b_29b9c39c');
assert.throws(() => Route.cloudDiagramHash('wrong'), /invalid cloud graph id/);

assert.strictEqual(Route.cloudShareIdFromHash('#s:s_0123456789abcdef0123456789abcdef'), 's_0123456789abcdef0123456789abcdef');
assert.strictEqual(Route.cloudShareIdFromHash('s:s_0123456789abcdef0123456789abcdef'), 's_0123456789abcdef0123456789abcdef');
assert.strictEqual(Route.cloudShareIdFromHash('#b:b_29b9c39c'), '');
assert.strictEqual(Route.cloudShareIdFromHash('#z:anything'), '');
assert.strictEqual(Route.cloudShareIdFromHash('#s:s_0123456789ABCDEF0123456789abcdef'), '');
assert.strictEqual(Route.cloudShareIdFromHash('#s:s_0123456789abcdef0123456789abcde'), '');
assert.strictEqual(Route.cloudShareHash('s_0123456789abcdef0123456789abcdef'), '#s:s_0123456789abcdef0123456789abcdef');
assert.throws(() => Route.cloudShareHash('s_short'), /invalid share id/);

const SHORT = 'p_' + 'a'.repeat(64);
assert.strictEqual(Route.cloudShortLinkIdFromHash('#p:' + SHORT), SHORT);
assert.strictEqual(Route.cloudShortLinkIdFromHash('p:' + SHORT), SHORT);
assert.strictEqual(Route.cloudShortLinkIdFromHash('#s:s_0123456789abcdef0123456789abcdef'), '');
assert.strictEqual(Route.cloudShortLinkIdFromHash('#z:anything'), '');
assert.strictEqual(Route.cloudShortLinkIdFromHash('#p:p_' + 'A'.repeat(64)), '');
assert.strictEqual(Route.cloudShortLinkIdFromHash('#p:p_short'), '');
assert.strictEqual(Route.cloudShortLinkHash(SHORT), '#p:' + SHORT);
assert.throws(() => Route.cloudShortLinkHash('p_short'), /invalid short link id/);

console.log('ok cloud-route');
