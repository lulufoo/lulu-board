'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Meta = require('../../packages/drawer-app/js/00-document-meta.js');
global.stripDocumentMeta = Meta.stripDocumentMeta;
global.updateMermaidTitle = Meta.updateMermaidTitle;
const Template = require('../../packages/drawer-app/js/00-kind-template.js');

const root = path.join(__dirname, '../..');
const dir = path.join(root, 'packages/drawer-app/templates');

assert.strictEqual(Template.kindTemplateFileName('welcome'), 'welcome.bmd');
assert.strictEqual(Template.kindTemplateFileName('boxes'), 'boxes.bmd');
assert.strictEqual(Template.kindTemplateFileName(''), 'boxes.bmd');
assert.strictEqual(Template.kindTemplateFileName('sequence'), 'sequenceDiagram.mmd');
assert.strictEqual(Template.kindTemplateFileName('sequenceDiagram'), 'sequenceDiagram.mmd');
assert.strictEqual(Template.kindTemplateFileName('C4Context'), 'C4Context.mmd');
assert.strictEqual(Template.kindTemplateFileName('block-beta'), '');

{
  const untitled = Template.applyUntitledTitle(fs.readFileSync(path.join(dir, 'boxes.bmd'), 'utf8'));
  assert.match(untitled, /^board "Untitled"/m);
  assert.doesNotMatch(untitled, /board "Demo"/);
}

{
  const untitled = Template.applyUntitledTitle(fs.readFileSync(path.join(dir, 'welcome.bmd'), 'utf8'));
  assert.match(untitled, /^board "Untitled"/m);
  assert.doesNotMatch(untitled, /board "Lulu Board"/);
  assert.match(untitled, /Welcome to Lulu Board/);
}

{
  const untitled = Template.applyUntitledTitle(fs.readFileSync(path.join(dir, 'sequenceDiagram.mmd'), 'utf8'));
  assert.match(untitled, /^%% title Untitled\nsequenceDiagram\n/);
  assert.match(untitled, /actor User/);
}

global.fetch = async function (url) {
  const name = String(url).replace(/^\.\/templates\//, '');
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return { ok: false, text: async () => '' };
  return { ok: true, text: async () => fs.readFileSync(file, 'utf8') };
};

(async function () {
  const board = await Template.loadKindTemplateSource('boxes');
  assert.match(board, /^board "Untitled"/m);
  assert.match(board, /box IN 501 "Inbox"/);
  const welcome = await Template.loadKindTemplateSource('welcome');
  assert.match(welcome, /^board "Untitled"/m);
  const sequence = await Template.loadKindTemplateSource('sequenceDiagram');
  assert.match(sequence, /^%% title Untitled\nsequenceDiagram\n/);
  await assert.rejects(() => Template.loadKindTemplateSource('block-beta'), /Template is unavailable/);
  console.log('ok kind-template');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
