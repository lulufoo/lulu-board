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
['favicon.svg', 'favicon-32.png', 'favicon.ico'].forEach((name) => {
  assert.ok(fs.existsSync(path.join(brand, name)), name + ' exists');
});

console.log('ok brand-favicon');
