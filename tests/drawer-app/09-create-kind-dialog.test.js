'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('packages/drawer-app/index.html');
const js = read('packages/drawer-app/js/09-create-kind-dialog.js');
const build = read('scripts/drawer-app-build/build.mjs');

const sheet = html.slice(html.indexOf('id="createKindDialog"'));
assert.match(sheet, /role="dialog" aria-modal="true" aria-labelledby="createKindTitle"/, 'reuses the modal sheet');
assert.match(sheet, /class="board-sign-in-sheet"/, 'sheet class matches sign-in');
assert.match(sheet, /data-create-kind="board"[^>]*>Board</, 'Board option');
assert.match(sheet, /data-create-kind="flowchart"[^>]*>Mermaid</, 'Mermaid option is flowchart');
assert.match(sheet, /Mermaid \(flowchart\)/, 'copy names Mermaid as flowchart');
assert.match(build, /06-board-confirm\.js[\s\S]*09-create-kind-dialog\.js/, 'dialog is in the drawer bundle');
assert.match(js, /event\.key !== "Escape"/, 'Esc is cancel');
assert.doesNotMatch(js, /saveBoardToHash|blankHashBoardSource|blankHashFlowchartSource|boardSourceEl/, 'does not write hash or source');

function makeEl(id) {
  const attrs = {};
  const el = {
    id,
    hidden: true,
    listeners: {},
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k] === undefined ? null : attrs[k]; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter((x) => x !== fn);
    },
    focus() { this.focused = true; },
    click() { (this.listeners.click || []).forEach((f) => f({ target: this })); },
  };
  return el;
}

function load() {
  const ids = ['createKindDialog', 'btnCreateKindBoard', 'btnCreateKindMermaid', 'createKindBackdrop'];
  const els = {};
  ids.forEach((id) => { els[id] = makeEl(id); });
  const docListeners = {};
  const ctx = {
    document: {
      getElementById: (id) => els[id] || null,
      addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
      removeEventListener(type, fn) {
        docListeners[type] = (docListeners[type] || []).filter((x) => x !== fn);
      },
    },
    globalThis: null,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  return { ctx, els, docListeners };
}

{
  const t = load();
  const picks = [];
  const cancels = [];
  t.ctx.openCreateKindDialog({
    onPick: (kind) => picks.push(kind),
    onCancel: () => cancels.push(1),
  });
  assert.strictEqual(t.els.createKindDialog.hidden, false, 'opens');
  assert.strictEqual(t.els.btnCreateKindBoard.focused, true, 'focuses Board');
  t.els.btnCreateKindBoard.click();
  assert.deepStrictEqual(picks, ['board']);
  assert.deepStrictEqual(cancels, []);
  assert.strictEqual(t.els.createKindDialog.hidden, true, 'closes after pick');
}

{
  const t = load();
  const picks = [];
  const cancels = [];
  t.ctx.openCreateKindDialog({
    onPick: (kind) => picks.push(kind),
    onCancel: () => cancels.push(1),
  });
  t.els.btnCreateKindMermaid.click();
  assert.deepStrictEqual(picks, ['flowchart']);
  assert.deepStrictEqual(cancels, []);
}

{
  const t = load();
  const cancels = [];
  t.ctx.openCreateKindDialog({ onCancel: () => cancels.push(1) });
  (t.docListeners.keydown || []).forEach((fn) => fn({ key: 'Escape', preventDefault() {} }));
  assert.deepStrictEqual(cancels, [1], 'Esc is onCancel');
  assert.strictEqual(t.els.createKindDialog.hidden, true);
}

{
  const t = load();
  const cancels = [];
  t.ctx.openCreateKindDialog({ onCancel: () => cancels.push(1) });
  t.ctx.closeCreateKindDialog();
  assert.deepStrictEqual(cancels, [1], 'close fires onCancel');
}

console.log('ok create-kind-dialog');
