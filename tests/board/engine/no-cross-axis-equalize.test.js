'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const renderJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/engine/board-render.js'), 'utf8');

assert.ok(/function resetBoxKidSizes\(content\)/.test(renderJs), 'size reset exists');
assert.ok(!/equalizeBoxKids|equalizeAllBoxKids/.test(renderJs), 'no sibling equalize');
assert.ok(!/kidCrossNeed/.test(renderJs), 'no shared cross-axis max');
assert.ok(!/const complete = max \+ 1/.test(renderJs), 'no max+1 pinning');
const body = renderJs.slice(renderJs.indexOf('function resetBoxKidSizes'), renderJs.indexOf('function resetAllBoxKidSizes'));
assert.ok(!/Math\.max/.test(body), 'reset does not compute sibling max');
assert.ok(!/style\.(height|width) = [a-z]+ \+ 'px'/.test(body), 'reset does not pin sizes');

console.log('ok no-cross-axis-equalize');
