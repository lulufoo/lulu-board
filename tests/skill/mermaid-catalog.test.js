'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const refs = path.join(root, 'skill/mermaid/references');
const catalog = fs.readFileSync(path.join(refs, 'catalog.md'), 'utf8');
const flowchart = fs.readFileSync(path.join(refs, 'flow/flowchart.md'), 'utf8');
const block = fs.readFileSync(path.join(refs, 'flow/block.md'), 'utf8');
const railroad = fs.readFileSync(path.join(refs, 'design/railroad.md'), 'utf8');
const ishikawa = fs.readFileSync(path.join(refs, 'map/ishikawa.md'), 'utf8');
const treemap = fs.readFileSync(path.join(refs, 'chart/treemap.md'), 'utf8');

assert.match(catalog, /Mermaid 12\.1\.0/, 'catalog pins Mermaid 12.1.0');
assert.match(catalog, /Pele 1\.7\.0/, 'catalog pins Pele 1.7.0');
assert.match(catalog, /\*\*Open\*\* is only `flowchart`/, 'only flowchart is open');
assert.match(catalog, /\| flowchart \| `flowchart` \/ `graph` \| open \|/, 'flowchart row is open');
assert.match(catalog, /`flowchart-elk` \| `flowchart`/, 'elk is an alias');
assert.match(catalog, /\| block \| `block` \/ `block-beta` \| closed \|/, 'block lists the short name');
assert.match(catalog, /\| xychart \| `xychart` \/ `xychart-beta` \| closed \|/, 'xychart lists the short name');
assert.match(catalog, /\| sankey \| `sankey` \/ `sankey-beta` \| closed \|/, 'sankey lists the short name');
assert.match(catalog, /\| packet \| `packet` \/ `packet-beta` \| closed \|/, 'packet lists the short name');
assert.match(catalog, /\| swimlane \| `swimlane-beta` \| closed \|/, 'swimlane is closed');
assert.match(catalog, /\| agentflow \| `agentflow-beta` \| closed \|/, 'agentflow is closed');
assert.match(catalog, /\| treeView \| `treeView-beta` \| closed \|/, 'treeView is closed');
assert.match(catalog, /\| usecase \| `usecase-beta` \| closed \|/, 'usecase is closed');
assert.match(catalog, /\| eventmodeling \| `eventmodeling` \| closed \|/, 'eventmodeling is closed');
assert.match(catalog, /\| railroad \| `railroad-beta` \/ `railroad-ebnf-beta` \/ `railroad-abnf-beta` \/ `railroad-peg-beta` \| closed \|/, 'railroad lists four notations');
assert.match(catalog, /\| cynefin \| `cynefin-beta` \| closed \|/, 'cynefin is closed');
assert.match(catalog, /\| wardley \| `wardley-beta` \| closed \|/, 'wardley is closed');
assert.match(catalog, /\| venn \| `venn-beta` \| closed \|/, 'venn is closed');
assert.match(catalog, /\| ishikawa \| `ishikawa` \/ `ishikawa-beta` \| closed \|/, 'ishikawa lists the short name');
assert.match(catalog, /\| treemap \| `treemap` \/ `treemap-beta` \| closed \|/, 'treemap lists the short name');
assert.match(flowchart, /`flowchart-elk` is an alias/, 'flowchart file marks elk as alias');
assert.match(block, /Keyword: `block`/, 'block file authors the short name');
assert.match(railroad, /Author `railroad-beta`/, 'railroad authors the IR keyword');
assert.match(ishikawa, /Author `ishikawa`/, 'ishikawa authors the short name');
assert.match(treemap, /Author `treemap`/, 'treemap authors the short name');
assert.strictEqual((catalog.match(/\| open \|/g) || []).length, 1, 'only one open type row');

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
