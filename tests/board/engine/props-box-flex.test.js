'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');

['boardDirEditor', 'boardAlignEditor', 'boardJustifyEditor', 'boardCapEditor'].forEach((id) => {
  const re = new RegExp('class="props-control"[\\s\\S]*id="' + id + '"[\\s\\S]*props-hint-end');
  assert.ok(re.test(html), id + ' sits in props-control with tip');
});
assert.ok(/\.props-control\s*\{[^}]*gap:\s*4px/.test(css), 'hint sits 4px under the control');
assert.ok(/\.props-field\s*\{[^}]*gap:\s*10px/.test(css), 'label-to-control stays 10px');

console.log('ok props-box-flex');
