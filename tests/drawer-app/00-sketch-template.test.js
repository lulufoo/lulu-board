'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require('../../packages/drawer-app/js/00-style-line.js');

const root = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'packages/drawer-app/templates/sketch.skt'), 'utf8');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const mount = fs.readFileSync(path.join(root, 'packages/drawer-app/js/03-sketch.js'), 'utf8');

assert.strictEqual(Style.bodyKind(src), 'sketch');
assert.doesNotMatch(src, /(?:style|content)\s+\{/);
const fragment = Style.decodeSketchContent(src);
assert.match(src, /^sketch "A quiet board"/);
assert.match(fragment, /A quiet board/);
assert.match(fragment, /Copy this link\. Use the \/sketch skill in an AI agent to edit this\./);
assert.match(fragment, /Warm sand inside the board\./);
assert.match(fragment, /rgba\(219,\s*76,\s*132,\s*\.4\)/);
assert.doesNotMatch(fragment, /#d0d7de/);
assert.doesNotMatch(fragment, /<script/i);
assert.match(html, /style-src 'self' 'unsafe-inline'/);
assert.match(html, /script-src 'self'/);
assert.doesNotMatch(html, /script-src 'self' 'unsafe-inline'/);
assert.match(mount, /script, iframe, object, embed, link/);

console.log('ok sketch template');
