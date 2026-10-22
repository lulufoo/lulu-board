'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const refs = path.join(root, 'skill/mermaid/references');
const catalog = fs.readFileSync(path.join(refs, 'catalog.md'), 'utf8');
const flowchart = fs.readFileSync(path.join(refs, 'flow/flowchart.md'), 'utf8');
const mindmap = fs.readFileSync(path.join(refs, 'flow/mindmap.md'), 'utf8');
const sequence = fs.readFileSync(path.join(refs, 'design/sequence.md'), 'utf8');
const classDoc = fs.readFileSync(path.join(refs, 'design/class.md'), 'utf8');
const stateDoc = fs.readFileSync(path.join(refs, 'design/state.md'), 'utf8');
const erDoc = fs.readFileSync(path.join(refs, 'design/er.md'), 'utf8');
const requirementDoc = fs.readFileSync(path.join(refs, 'design/requirement.md'), 'utf8');
const c4Doc = fs.readFileSync(path.join(refs, 'design/c4.md'), 'utf8');
const eventmodelingDoc = fs.readFileSync(path.join(refs, 'design/eventmodeling.md'), 'utf8');
const usecaseDoc = fs.readFileSync(path.join(refs, 'design/usecase.md'), 'utf8');
const railroadDoc = fs.readFileSync(path.join(refs, 'design/railroad.md'), 'utf8');
const block = fs.readFileSync(path.join(refs, 'flow/block.md'), 'utf8');
const railroad = fs.readFileSync(path.join(refs, 'design/railroad.md'), 'utf8');
const ishikawa = fs.readFileSync(path.join(refs, 'map/ishikawa.md'), 'utf8');
const treemap = fs.readFileSync(path.join(refs, 'chart/treemap.md'), 'utf8');

assert.match(catalog, /Mermaid 12\.1\.0/, 'catalog pins Mermaid 12.1.0');
assert.match(catalog, /Pele 1\.7\.0/, 'catalog pins Pele 1.7.0');
assert.match(catalog, /\*\*Open\*\* is `flowchart`, `mindmap`, `sequence`, `class`, `state`, `er`, `requirement`, `c4`, `eventmodeling`, `usecase`, and `railroad`/, 'flowchart, mindmap, and Design 9 are open');
assert.match(catalog, /\| flowchart \| `flowchart` \/ `graph` \| open \|/, 'flowchart row is open');
assert.match(catalog, /\| mindmap \| `mindmap` \| open \|/, 'mindmap row is open');
assert.match(catalog, /\| sequence \| `sequenceDiagram` \| open \|/, 'sequence row is open');
assert.match(catalog, /\| class \| `classDiagram` \/ `classDiagram-v2` \| open \|/, 'class row is open');
assert.match(catalog, /\| state \| `stateDiagram` \/ `stateDiagram-v2` \| open \|/, 'state row is open');
assert.match(catalog, /\| er \| `erDiagram` \| open \|/, 'er row is open');
assert.match(catalog, /\| requirement \| `requirement` \/ `requirementDiagram` \| open \|/, 'requirement row is open');
assert.match(catalog, /\| c4 \| `C4Context` \/ `C4Container` \/ `C4Component` \/ `C4Dynamic` \/ `C4Deployment` \| open \|/, 'c4 row is open');
assert.match(catalog, /`flowchart-elk` \| `flowchart`/, 'elk is an alias');
assert.match(catalog, /\| block \| `block` \/ `block-beta` \| closed \|/, 'block lists the short name');
assert.match(catalog, /\| xychart \| `xychart` \/ `xychart-beta` \| closed \|/, 'xychart lists the short name');
assert.match(catalog, /\| sankey \| `sankey` \/ `sankey-beta` \| closed \|/, 'sankey lists the short name');
assert.match(catalog, /\| packet \| `packet` \/ `packet-beta` \| closed \|/, 'packet lists the short name');
assert.match(catalog, /\| swimlane \| `swimlane-beta` \| closed \|/, 'swimlane is closed');
assert.match(catalog, /\| agentflow \| `agentflow-beta` \| closed \|/, 'agentflow is closed');
assert.match(catalog, /\| treeView \| `treeView-beta` \| closed \|/, 'treeView is closed');
assert.match(catalog, /\| usecase \| `usecase-beta` \| open \|/, 'usecase is open');
assert.match(catalog, /\| eventmodeling \| `eventmodeling` \| open \|/, 'eventmodeling is open');
assert.match(catalog, /\| railroad \| `railroad-beta` \/ `railroad-ebnf-beta` \/ `railroad-abnf-beta` \/ `railroad-peg-beta` \| open \|/, 'railroad lists four notations');
assert.match(catalog, /\| cynefin \| `cynefin-beta` \| closed \|/, 'cynefin is closed');
assert.match(catalog, /\| wardley \| `wardley-beta` \| closed \|/, 'wardley is closed');
assert.match(catalog, /\| venn \| `venn-beta` \| closed \|/, 'venn is closed');
assert.match(catalog, /\| ishikawa \| `ishikawa` \/ `ishikawa-beta` \| closed \|/, 'ishikawa lists the short name');
assert.match(catalog, /\| treemap \| `treemap` \/ `treemap-beta` \| closed \|/, 'treemap lists the short name');
assert.match(flowchart, /`flowchart-elk` is an alias/, 'flowchart file marks elk as alias');
assert.match(mindmap, /Radial or Logic/, 'mindmap names Radial and Logic');
assert.match(mindmap, /Toolbar: Root, Node, Delete/, 'mindmap names the toolbar');
assert.match(sequence, /Pele/, 'sequence names Pele preview');
assert.match(sequence, /Title/, 'sequence names Title');
assert.match(classDoc, /Pele/, 'class names Pele preview');
assert.match(classDoc, /Title/, 'class names Title');
assert.match(stateDoc, /Pele/, 'state names Pele preview');
assert.match(stateDoc, /Title/, 'state names Title');
assert.match(erDoc, /Pele/, 'er names Pele preview');
assert.match(erDoc, /Title/, 'er names Title');
assert.match(requirementDoc, /Pele/, 'requirement names Pele preview');
assert.match(requirementDoc, /Title/, 'requirement names Title');
assert.match(c4Doc, /Pele/, 'c4 names Pele preview');
assert.match(c4Doc, /first-line keyword/, 'c4 switches view in source');
assert.match(eventmodelingDoc, /Pele/, 'eventmodeling names Pele preview');
assert.match(eventmodelingDoc, /Title/, 'eventmodeling names Title');
assert.match(usecaseDoc, /Pele/, 'usecase names Pele preview');
assert.match(usecaseDoc, /Title/, 'usecase names Title');
assert.match(railroadDoc, /Pele/, 'railroad names Pele preview');
assert.match(railroadDoc, /Title/, 'railroad names Title');
assert.match(block, /Keyword: `block`/, 'block file authors the short name');
assert.match(railroad, /Author `railroad-beta`/, 'railroad authors the IR keyword');
assert.match(ishikawa, /Author `ishikawa`/, 'ishikawa authors the short name');
assert.match(treemap, /Author `treemap`/, 'treemap authors the short name');
assert.strictEqual((catalog.match(/\| open \|/g) || []).length, 11, 'eleven open type rows');

const files = [
  'flow/flowchart.md', 'flow/block.md', 'flow/mindmap.md', 'flow/architecture.md',
  'flow/swimlane.md', 'flow/agentflow.md', 'flow/treeView.md',
  'design/sequence.md', 'design/class.md', 'design/state.md', 'design/er.md',
  'design/requirement.md', 'design/c4.md',
  'design/usecase.md', 'design/eventmodeling.md', 'design/railroad.md',
  'time/gantt.md', 'time/journey.md', 'time/timeline.md', 'time/gitGraph.md', 'time/kanban.md',
  'chart/pie.md', 'chart/quadrant.md', 'chart/xychart.md', 'chart/sankey.md', 'chart/packet.md', 'chart/radar.md',
  'chart/treemap.md',
  'map/cynefin.md', 'map/wardley.md', 'map/venn.md', 'map/ishikawa.md',
];
files.forEach((rel) => {
  assert.ok(fs.existsSync(path.join(refs, rel)), rel + ' exists');
});
assert.strictEqual(files.length, 32, '32 catalog type files');

console.log('ok mermaid-catalog skill');
