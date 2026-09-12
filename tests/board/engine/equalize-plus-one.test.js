'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const renderJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/engine/board-render.js'), 'utf8');

assert.ok(/const complete = max \+ 1;/.test(renderJs), 'equalize completes with +1');
assert.ok(/el\.style\.width = complete \+ 'px'/.test(renderJs), 'column pin uses completed width');
assert.ok(/el\.style\.minWidth = complete \+ 'px'/.test(renderJs), 'column minWidth uses completed width');
assert.ok(!/el\.style\.width = max \+ 'px'/.test(renderJs), 'column pin does not write raw max');
assert.ok(
  !/const complete = Math\.round\(max\)/.test(renderJs),
  'completion is plus-one, not round'
);

console.log('ok equalize-plus-one');
