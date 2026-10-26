import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/diagram.js'), 'utf8');
const boardEdit = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/board.js'), 'utf8');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/kinds/diagram.js')), 'host file is in src/kinds');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/kinds/board.js')), 'Board edit file is in src/kinds');
assert.doesNotMatch(boardEdit, /function renderDiagram/, 'Board edit file no longer owns render');
assert.match(boardJs, /function renderFlowchart/, 'flowchart render path exists');
assert.match(boardJs, /function renderMindmap/, 'mindmap render path exists');
assert.match(boardJs, /function refuseUnsupportedMermaid/, 'unsupported mermaid is refused');
assert.match(boardJs, /This diagram type cannot be rendered/, 'refuse copy is locked');
assert.doesNotMatch(boardJs, /Only flowchart and mindmap can be rendered/, 'Design is no longer in the refuse copy');
assert.match(boardJs, /kind === "flowchart"/, 'renderDiagram dispatches flowchart');
assert.match(boardJs, /kind === "mindmap"/, 'renderDiagram dispatches mindmap');
assert.match(boardJs, /kind === "sketch"/, 'renderDiagram dispatches sketch');
{
  const sketch = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/sketch.js'), 'utf8');
  const boot = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/chrome-boot.js'), 'utf8');
  assert.match(sketch, /readyState === "complete"/, 'srcdoc that is already loaded still finishes the camera');
  assert.match(sketch, /var finished = false/, 'iframe load and readyState do not finish twice');
  assert.match(boot, /previewHasPaint\(previewEl\)/, 'restore skip accepts sketch paint');
}
assert.match(boardJs, /isDesignKind\(kind\)/, 'renderDiagram dispatches Design through Pele');
assert.match(boardJs, /function renderDesignPele/, 'Design has a shared Pele path');
assert.match(boardJs, /function paintPeleSvg/, 'flowchart and Design share Pele paint');
assert.match(boardJs, /kind === "mermaid-unsupported"/, 'renderDiagram dispatches unsupported mermaid');
assert.match(boardJs, /MindmapEdit\.render/, 'mindmap uses the custom SVG renderer');
assert.doesNotMatch(boardJs, /function renderMindmap[\s\S]*window\.pele/, 'mindmap does not render through Pele');

console.log('ok kind-route');
