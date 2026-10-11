'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const brand = path.join(__dirname, '../../../packages/drawer-app/brand');
const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');

assert.ok(/href="\.\/favicon\.ico"/.test(html), 'page links favicon.ico');
assert.ok(/href="\.\/favicon-32\.png"/.test(html), 'page links favicon png');
assert.ok(/href="\.\/favicon\.svg"/.test(html), 'page links favicon svg');
assert.ok(!/__FAVICON_PNG__/.test(html), 'no build placeholder');
assert.ok(/class="board-brand"[\s\S]*class="board-edit-tools"/.test(html), 'brand mark sits before the editing tools');
assert.ok(/board-brand-mark/.test(html), 'toolbar carries the brand mark');
assert.match(html, /fill="#db4c84"/, 'toolbar mark uses the landing pink');
assert.match(html, /fill="#ffd166"/, 'toolbar mark uses the landing yellow');
assert.doesNotMatch(html, /fill="#1d1d1f"/, 'toolbar mark is no longer black');
const svg = fs.readFileSync(path.join(brand, 'favicon.svg'), 'utf8');
assert.match(svg, /fill="#db4c84"/, 'favicon.svg uses the landing pink');
assert.match(svg, /fill="#ffd166"/, 'favicon.svg uses the landing yellow');
['favicon.svg', 'favicon-32.png', 'favicon.ico'].forEach((name) => {
  assert.ok(fs.existsSync(path.join(brand, name)), name + ' exists');
});

console.log('ok brand-favicon');
