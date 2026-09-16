'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const labelRule = css.match(/\.style-section-label\s*\{[^}]+\}/);
assert.ok(labelRule, 'style-section-label rule exists');
assert.ok(!/text-transform:\s*uppercase/.test(labelRule[0]), 'Style section labels are not forced uppercase');

const labels = [...html.matchAll(/<p class="style-section-label">([^<]+)<\/p>/g)].map((m) => m[1]);
assert.deepStrictEqual(labels, ['Theme', 'Font Size', 'Max Item Width', 'Link']);
assert.ok(
  /Applies when Width Cap is on · non-default saves in source/.test(html),
  'Max Item Width hint names Width Cap, not cap',
);

console.log('ok style-section-labels');
