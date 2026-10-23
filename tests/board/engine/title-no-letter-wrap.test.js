'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const boxJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/box/board-box.js'), 'utf8');

assert.ok(
  /\.board-title-name \{ display: block; min-width: min-content; overflow-wrap: break-word; \}/.test(css),
  'title does not wrap mid-word'
);
assert.ok(
  /el\.style\.minWidth = nested \? 'min-content' : '0'/.test(boxJs),
  'nested box keeps min-content'
);

console.log('ok title-no-letter-wrap');
