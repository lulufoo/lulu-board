import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const labelRule = css.match(/\.style-section-label\s*\{[^}]+\}/);
assert.ok(labelRule, 'style-section-label rule exists');
assert.ok(!/text-transform:\s*uppercase/.test(labelRule[0]), 'Style section labels are not forced uppercase');

const labels = [...html.matchAll(/<p class="style-section-label">([^<]+)<\/p>/g)].map((m) => m[1]);
assert.deepStrictEqual(labels, ['Palette', 'Font Size', 'Max Width', 'Link']);
assert.ok(
  (html.match(/Middle is default · non-default saves in source/g) || []).length === 2,
  'Font Size and Max Width share the default-stage hint',
);

console.log('ok style-section-labels');
