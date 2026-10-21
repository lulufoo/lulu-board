'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const refs = path.join(root, 'skill/mermaid/references');
const catalog = fs.readFileSync(path.join(refs, 'catalog.md'), 'utf8');
const flowchart = fs.readFileSync(path.join(refs, 'flow/flowchart.md'), 'utf8');
const block = fs.readFileSync(path.join(refs, 'flow/block.md'), 'utf8');

assert.match(catalog, /Mermaid 12\.1\.0/, 'catalog pins Mermaid 12.1.0');
assert.match(catalog, /Pele 1\.7\.0/, 'catalog pins Pele 1.7.0');
assert.match(catalog, /\*\*Open\*\* is only `flowchart`/, 'only flowchart is open');
assert.match(catalog, /\| flowchart \| `flowchart` \/ `graph` \| open \|/, 'flowchart row is open');
assert.match(catalog, /`flowchart-elk` \| `flowchart`/, 'elk is an alias');
assert.match(catalog, /\| block \| `block` \/ `block-beta` \| closed \|/, 'block lists the short name');
assert.match(catalog, /\| xychart \| `xychart` \/ `xychart-beta` \| closed \|/, 'xychart lists the short name');
assert.match(catalog, /\| sankey \| `sankey` \/ `sankey-beta` \| closed \|/, 'sankey lists the short name');
assert.match(catalog, /\| packet \| `packet` \/ `packet-beta` \| closed \|/, 'packet lists the short name');
assert.match(flowchart, /`flowchart-elk` is an alias/, 'flowchart file marks elk as alias');
assert.match(block, /Keyword: `block`/, 'block file authors the short name');
assert.doesNotMatch(catalog, /swimlane|agentflow|treeView|usecase|eventmodeling|railroad|cynefin|wardley|venn|ishikawa|treemap/, '11 Pele extras wait for the next issue');

const files = [
  'flow/flowchart.md', 'flow/block.md', 'flow/mindmap.md', 'flow/architecture.md',
  'design/sequence.md', 'design/class.md', 'design/state.md', 'design/er.md',
  'design/requirement.md', 'design/c4.md',
  'time/gantt.md', 'time/journey.md', 'time/timeline.md', 'time/gitGraph.md', 'time/kanban.md',
  'chart/pie.md', 'chart/quadrant.md', 'chart/xychart.md', 'chart/sankey.md', 'chart/packet.md', 'chart/radar.md',
];
files.forEach((rel) => {
  assert.ok(fs.existsSync(path.join(refs, rel)), rel + ' exists');
});
assert.strictEqual(files.length, 21, '21 existing type files');

console.log('ok mermaid-catalog skill');
