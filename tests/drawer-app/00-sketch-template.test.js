'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require('../../packages/drawer-app/js/00-style-line.js');

const root = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'packages/drawer-app/templates/sketch.skt'), 'utf8');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const mount = fs.readFileSync(path.join(root, 'packages/drawer-app/js/03-sketch.js'), 'utf8');
const Sketch = require('../../packages/drawer-app/js/03-sketch.js');

assert.strictEqual(Style.bodyKind(src), 'sketch');
assert.doesNotMatch(src, /(?:style|content)\s+\{/);
const fragment = Style.decodeSketchContent(src);
assert.match(src, /sketch "A HTML board"/);
assert.match(fragment, /A <span class="q">HTML<\/span> board/);
assert.match(fragment, /Copy this link\. Use the \/sketch skill in an AI agent to edit this\./);
assert.match(fragment, /Content is written by AI/);
assert.match(fragment, />Sketch</);
assert.doesNotMatch(fragment, /A quiet board/);
assert.doesNotMatch(fragment, /Warm sand inside the board\./);
assert.doesNotMatch(fragment, /#d0d7de/);
assert.doesNotMatch(fragment, /<script/i);
assert.match(html, /style-src 'self' 'unsafe-inline'/);
assert.match(html, /script-src 'self'/);
assert.doesNotMatch(html, /script-src 'self' 'unsafe-inline'/);
assert.match(mount, /script, iframe, object, embed, link/);
assert.match(mount, /frame\.className = "sketch-frame"/, 'Board owns an outer sketch frame');
assert.match(mount, /host\.attachShadow\(\{ mode: "open" \}\)/, 'Sketch mounts in a shadow root');
assert.match(mount, /shadowRoot\.appendChild\(sketchFragmentRoot\(fragment\)\)/, 'Fragment styles stay inside the shadow root');
assert.match(mount, /shadowRoot\.querySelector\("\.sketch-board"\)/, 'Canvas measures the shadow-tree board');
assert.doesNotMatch(mount, /host\.appendChild\(sketchFragmentRoot\(fragment\)\)/, 'Fragment does not mount in the Board document');
assert.strictEqual(
  Sketch.sketchShadowCss(':root { --bg: #faf7f1; } .page :ROOT { color: var(--bg); }'),
  ':host { --bg: #faf7f1; } .page :host { color: var(--bg); }',
  'legacy sketch root selectors target the shadow host',
);
assert.strictEqual(Sketch.sketchShadowCss('.rooted { color: black; }'), '.rooted { color: black; }', 'only :root is rewritten');

console.log('ok sketch template');
