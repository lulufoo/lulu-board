import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/09-props-tabs.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/src/state/props-panes.js'), 'utf8');
const boardJs = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/src/kinds/board.js'), 'utf8');
const fieldCss = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');

const fieldsAt = html.indexOf('id="propsFields"');
const fieldsEnd = html.indexOf('id="flowchartDocTitleField"');
const propsHtml = html.slice(fieldsAt, fieldsEnd);
const aiAt = propsHtml.indexOf('id="props-ai-panel"');
const youAt = propsHtml.indexOf('id="props-you-panel"');
const aiHtml = propsHtml.slice(aiAt, youAt);
const youHtml = propsHtml.slice(youAt);

assert.ok(/id="props-pane-ai"[^>]*>AI</.test(propsHtml), 'AI tab label');
assert.ok(/id="props-pane-you"[^>]*>You</.test(propsHtml), 'You tab label');
assert.ok(!/class="shell-tab"/.test(propsHtml), 'Properties tabs do not reuse Mine/Shared class');
assert.ok(/data-props-pane="ai"/.test(propsHtml), 'default pane is AI');
assert.ok(youAt > aiAt, 'You panel follows AI panel');

['boardIdWrap', 'boardTypeField', 'boardShapeWrap', 'boardArrowWrap', 'boardIconField', 'boardTitleField', 'boardDirField', 'boardAlignField', 'boardJustifyField', 'board-order-field'].forEach((id) => {
  assert.ok(aiHtml.includes('id="' + id + '"'), id + ' is on AI');
  assert.ok(!youHtml.includes('id="' + id + '"'), id + ' is not on You');
});
assert.ok(youHtml.includes('id="board-max-width-field"'), 'Max Width is on You');
assert.ok(youHtml.includes('id="boardNodeFontField"'), 'Font Size is on You');
assert.ok(!aiHtml.includes('id="board-max-width-field"'), 'Max Width is not on AI');
assert.ok(!aiHtml.includes('id="boardNodeFontField"'), 'Font Size is not on AI');
assert.ok(!propsHtml.includes('id="flowchartPropsFields"'), 'flowchart props stay outside Boxes panes');

assert.ok(/background:\s*var\(--wash\)/.test(css), 'tab track uses wash');
assert.ok(/border-radius:\s*11px/.test(css), 'tab track radius 11px');
assert.ok(/height:\s*30px/.test(css), 'tab height 30px');
assert.ok(/border-radius:\s*8px/.test(css), 'selected tab radius 8px');
assert.ok(/box-shadow:\s*var\(--press\)/.test(css), 'selected tab uses press');
assert.ok(/data-props-pane="ai"\] #props-you-panel/.test(css), 'AI pane hides You fields');

assert.ok(/function syncPropsPanes/.test(js), 'syncs pane from field visibility');
assert.ok(/bar\.hidden = !youOn/.test(js), 'hides tabs when You has no fields');
assert.ok(!/saveDrawerUi/.test(js), 'does not persist the tab');
assert.ok(/syncPropsPanes\(\)/.test(boardJs), 'Boxes inspect syncs panes');

assert.ok(/\.props-field\s*\{[^}]*gap:\s*10px/.test(fieldCss), 'field chrome gap stays 10px');
assert.ok(/\.props-fields\s*\{[^}]*gap:\s*14px/.test(fieldCss), 'field group gap stays 14px');

console.log('ok props-ai-you');
