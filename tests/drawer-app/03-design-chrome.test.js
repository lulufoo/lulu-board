'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Meta = require('../../packages/drawer-app/js/00-document-meta.js');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/03-diagram.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'packages/drawer-app/js/03-design.js'), 'utf8');
const diagram = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-diagram.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/drawer-app-build/build.mjs'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'packages/drawer-app/css/08-workspace-shell.css'), 'utf8');

assert.match(html, /id="designDocTitleEditor"/);
assert.match(html, /id="designDocTitleField"/);
assert.doesNotMatch(js, /boardTitleEditor/);
assert.doesNotMatch(js, /flowchartTitleEditor/);
assert.doesNotMatch(js, /flowchartDocTitleEditor/);
assert.doesNotMatch(js, /mindmapDocTitleEditor/);
assert.doesNotMatch(js, /FlowchartEdit/);
assert.doesNotMatch(js, /MindmapEdit/);
assert.doesNotMatch(js, /btnFlowchartAdd/);
assert.doesNotMatch(html, /id="btnDesign/);
assert.match(js, /updateMermaidTitle/);
assert.match(js, /fillDesignProps/);
assert.match(js, /designDocTitleField\.hidden = false/);
assert.match(js, /propsKindLabel\.textContent = document\.documentElement\.dataset\.kind/);
assert.match(diagram, /designDocTitleField/, 'kind switch hides Design Title');
assert.match(diagram, /fillDesignProps/, 'Design render fills Title');
assert.match(build, /03-design\.js/);
assert.match(css, /#designDocTitleField\[hidden\]/);
assert.match(css, /html\[data-pele="1"\] \.board-edit-tools/, 'Design hides Board tools');
assert.match(shellCss, /#designDocTitleEditor/);

{
  const src = '%% style default\nsequenceDiagram\n  A->>B: hi\n';
  const next = Meta.updateMermaidTitle(src, 'Checkout');
  assert.strictEqual(next, '%% style default\n%% title Checkout\nsequenceDiagram\n  A->>B: hi\n');
  assert.strictEqual(Meta.diagramTitleFromBody(next), 'Checkout');
  assert.strictEqual(Meta.updateMermaidTitle(next, 'Ship'), '%% style default\n%% title Ship\nsequenceDiagram\n  A->>B: hi\n');
  assert.ok(!/%% title/.test(Meta.updateMermaidTitle(next, '')), 'clearing Title drops the line');
}

console.log('ok design-chrome');
