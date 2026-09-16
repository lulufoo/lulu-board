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
  const board = fs.readFileSync(path.join(__dirname, '../../skill/board/SKILL.md'), 'utf8');
  const drawer = fs.readFileSync(path.join(__dirname, '../../skill/drawer/SKILL.md'), 'utf8');
  const vocab = fs.readFileSync(path.join(__dirname, '../../skill/board/references/vocab.md'), 'utf8');
  assert.ok(/Mint without meta or style/.test(board), 'board SKILL mints without stash');
  assert.ok(/leave those\s+lines unchanged/.test(board), 'board SKILL leaves stash on update');
  assert.ok(/Omit on mint; do not change on update/.test(drawer), 'drawer SKILL names stash rule');
  assert.ok(/meta <base64>/.test(vocab), 'vocab names meta as base64');
  assert.ok(!/\{\"id\"/.test(vocab), 'vocab hides meta JSON');
}

console.log('ok document-meta');
