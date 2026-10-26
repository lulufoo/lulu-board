import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const web = fs.readFileSync(path.join(root, 'scripts/build-web/build.mjs'), 'utf8');
const flowchart = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/flowchart.js'), 'utf8');
const mindmap = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/mindmap.js'), 'utf8');
const mermaidFlow = fs.readFileSync(path.join(root, 'packages/mermaid-ext/flowchart/index.js'), 'utf8');
const mermaidMind = fs.readFileSync(path.join(root, 'packages/mermaid-ext/mindmap/index.js'), 'utf8');

assert.doesNotMatch(html, /flowchart\.min\.js/, 'index does not load FlowchartEdit bundle');
assert.doesNotMatch(html, /mindmap\.min\.js/, 'index does not load MindmapEdit bundle');
assert.doesNotMatch(web, /flowchart\.min\.js/, 'web build does not ship FlowchartEdit bundle');
assert.doesNotMatch(web, /mindmap\.min\.js/, 'web build does not ship MindmapEdit bundle');
assert.ok(fs.existsSync(path.join(root, 'packages/mermaid-ext/flowchart/index.js')), 'flowchart source is in Board');
assert.ok(fs.existsSync(path.join(root, 'packages/mermaid-ext/mindmap/index.js')), 'mindmap source package is present');
assert.match(flowchart, /from '\.\.\/\.\.\/\.\.\/mermaid-ext\/flowchart\/index\.js'/, 'drawer imports FlowchartEdit');
assert.match(mindmap, /from '\.\.\/\.\.\/\.\.\/mermaid-ext\/mindmap\/index\.js'/, 'drawer imports MindmapEdit');
assert.doesNotMatch(mermaidFlow, /root\.FlowchartEdit/, 'flowchart does not assign a page global');
assert.doesNotMatch(mermaidMind, /root\.MindmapEdit/, 'mindmap does not assign a page global');

console.log('ok flowchart-ext');
