'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/drawer-app-build/build.mjs'), 'utf8');
const web = fs.readFileSync(path.join(root, 'scripts/web-build/build.mjs'), 'utf8');

assert.match(html, /flowchart\.min\.js/, 'index loads FlowchartEdit bundle');
assert.match(build, /flowchart\.min\.js/, 'drawer-app build copies FlowchartEdit');
assert.match(web, /flowchart\.min\.js/, 'web build requires FlowchartEdit');
assert.ok(fs.existsSync(path.join(root, 'packages/mermaid-ext/flowchart/index.js')), 'flowchart source is in Board');
assert.ok(fs.existsSync(path.join(root, 'packages/mermaid-ext/mindmap/index.js')), 'mindmap source package is present');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/vendor/mindmap.min.js')), 'MindmapEdit is bundled');
assert.match(
  fs.readFileSync(path.join(root, 'packages/drawer-app/vendor/mindmap.min.js'), 'utf8'),
  /MindmapEdit/,
  'bundle exports MindmapEdit'
);
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/vendor/flowchart.min.js')), 'FlowchartEdit is bundled');
assert.match(
  fs.readFileSync(path.join(root, 'packages/drawer-app/vendor/flowchart.min.js'), 'utf8'),
  /FlowchartEdit/,
  'bundle exports FlowchartEdit'
);

console.log('ok flowchart-ext');
