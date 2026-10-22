'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require('../../packages/drawer-app/js/00-style-line.js');
global.DrawerStyleLine = Style;
const Meta = require('../../packages/drawer-app/js/00-document-meta.js');

function token(id, version) {
  return Buffer.from(JSON.stringify({ id: id, version: version }), 'utf8').toString('base64');
}

{
  const raw = Meta.joinDocument({ id: 'b_0fc10001', version: 3 }, 'board "A"\n');
  assert.strictEqual(raw.split('\n')[0], 'meta ' + token('b_0fc10001', 3));
  assert.ok(!raw.split('\n')[0].includes('{'), raw);
  const doc = Meta.splitDocument(raw);
  assert.deepStrictEqual(doc.meta, { id: 'b_0fc10001', version: 3 });
  assert.strictEqual(doc.body, 'board "A"\n');
}

{
  const doc = Meta.splitDocument('meta {"id":"b_0fc10001","version":3}\nboard "A"\n');
  assert.deepStrictEqual(doc.meta, { id: 'b_0fc10001', version: 3 });
  assert.strictEqual(doc.body, 'board "A"\n');
}

{
  const stacked = 'meta {"id":"b_22bc0e55","version":1}\nmeta ' + token('b_22bc0e55', 152) + '\nboard "A"\n';
  const doc = Meta.splitDocument(stacked);
  assert.deepStrictEqual(doc.meta, { id: 'b_22bc0e55', version: 152 });
  assert.strictEqual(doc.body, 'board "A"\n');
}

{
  assert.throws(() => Meta.splitDocument('board "A"\n'), /document meta required/);
  assert.throws(() => Meta.splitDocument('meta not-valid-base64!!!\nboard "A"\n'), /document meta required/);
}

{
  const blank = Meta.blankHashBoardSource("Untitled");
  assert.strictEqual(blank, 'board "Untitled"\n');
  assert.strictEqual(Meta.stripDocumentMeta('meta {"id":"b_0fc10001","version":3}\nboard "A"\n'), 'board "A"\n');
  assert.strictEqual(
    Meta.stripDocumentMeta('%% meta {"id":"m_51c67540","version":1}\nflowchart TD\n  A-->B\n'),
    'flowchart TD\n  A-->B\n'
  );
}

{
  const seed = Meta.blankHashFlowchartSource();
  assert.strictEqual(seed, '%% title Untitled\nflowchart TD\n');
  assert.strictEqual(Style.bodyKind(seed), 'flowchart');
  assert.strictEqual(Meta.diagramTitleFromBody(seed), 'Untitled');
}

{
  const seed = Meta.blankHashMindmapSource();
  assert.strictEqual(seed, '%% title Untitled\nmindmap\n  Topic\n');
  assert.strictEqual(Style.bodyKind(seed), 'mindmap');
  assert.strictEqual(Meta.diagramTitleFromBody(seed), 'Untitled');
}

{
  const body = 'classDiagram\n  class Service\n';
  const titled = Meta.updateMermaidTitle(body, 'Catalog');
  assert.strictEqual(titled, '%% title Catalog\nclassDiagram\n  class Service\n');
  assert.strictEqual(Meta.diagramTitleFromBody(titled), 'Catalog');
  assert.strictEqual(Meta.updateMermaidTitle(titled, ''), body);
}

{
  const seed = Meta.blankHashSequenceSource();
  assert.match(seed, /^%% title Untitled\nsequenceDiagram\n/);
  assert.match(seed, /actor User/);
  assert.strictEqual(Style.bodyKind(seed), 'sequence');
  assert.strictEqual(Meta.diagramTitleFromBody(seed), 'Untitled');
  assert.strictEqual(Meta.blankHashSourceForKind('sequenceDiagram'), seed);
  assert.strictEqual(Meta.blankHashSourceForKind('sequence'), seed);
}

{
  const board = fs.readFileSync(path.join(__dirname, '../../skill/board/SKILL.md'), 'utf8');
  const vocab = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/skill-assets/vocab.md'), 'utf8');
  assert.ok(/Mint without style/.test(board), 'board SKILL mints without stash');
  assert.ok(/leave those\s+lines unchanged/.test(board), 'board SKILL leaves stash on update');
  assert.ok(/style <base64>/.test(vocab), 'vocab names style as stash');
  assert.ok(/leftover `meta <base64>`/.test(vocab), 'vocab treats leftover meta as non-identity');
  assert.ok(/never writes it back/.test(vocab), 'vocab says leftover meta is not rewritten');
  assert.ok(!/\{\"id\"/.test(vocab), 'vocab hides meta JSON');
  const shell = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/01-shell-state.js'), 'utf8');
  const boardJs = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/02-board.js'), 'utf8');
  const diagram = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/02-diagram.js'), 'utf8');
  assert.ok(!/joinDocument/.test(shell + boardJs + diagram), 'drawer production does not join envelope');
}

console.log('ok document-meta');
