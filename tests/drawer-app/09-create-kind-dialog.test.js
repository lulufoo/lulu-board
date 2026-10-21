'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('packages/drawer-app/index.html');
const js = read('packages/drawer-app/js/09-create-kind-dialog.js');
const css = read('packages/drawer-app/css/09-create-kind-dialog.css');
const build = read('scripts/drawer-app-build/build.mjs');

const sheet = html.slice(html.indexOf('id="createKindDialog"'));
assert.match(sheet, /role="dialog" aria-modal="true" aria-labelledby="createKindTitle"/, 'a real modal dialog');
assert.match(sheet, /class="create-kind-pop"/, 'search-style pop, not the sign-in sheet');
assert.doesNotMatch(sheet, /board-sign-in-sheet/, 'create dialog does not reuse the small sign-in sheet');
assert.match(sheet, /id="createKindFilter"/, 'filter field');
assert.match(sheet, /<kbd>ESC<\/kbd>/, 'escape keycap is uppercase');
assert.match(sheet, /id="createKindList"/, 'type list');
assert.match(build, /06-confirm\.js[\s\S]*09-create-kind-dialog\.js/, 'dialog is in the drawer bundle');
assert.match(css, /\.create-kind-label/, 'two class headers live in CSS');
assert.match(js, /cls: "Board"/, 'Board class');
assert.match(js, /cls: "Mermaid"/, 'Mermaid class');
assert.match(js, /name: "Flowchart"/, 'lists flowchart');
assert.match(js, /name: "Mindmap"/, 'lists other mermaid types');
assert.doesNotMatch(js, /Ready/, 'no Ready badge');
assert.doesNotMatch(js + css, /create-kind-tag/, 'no per-row class tag');
assert.match(js, /event\.key !== "Escape"/, 'Esc is cancel');
assert.doesNotMatch(js, /saveVelaToHash|blankHashBoardSource|blankHashFlowchartSource|velaSourceEl/, 'does not write hash or source');

function makeEl(id) {
  const attrs = {};
  const el = {
    id,
    hidden: true,
    value: '',
    innerHTML: '',
    disabled: false,
    listeners: {},
    parentNode: null,
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k] === undefined ? null : attrs[k]; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter((x) => x !== fn);
    },
    focus() { this.focused = true; },
  };
  return el;
}

function load() {
  const ids = ['createKindDialog', 'createKindList', 'createKindFilter', 'createKindBackdrop'];
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

function clickKind(t, kind, disabled) {
  const btn = {
    disabled: !!disabled,
    getAttribute(name) { return name === 'data-create-kind' ? kind : null; },
    parentNode: t.els.createKindList,
  };
  (t.els.createKindList.listeners.click || []).forEach((fn) => fn({ target: btn }));
}

{
  const items = load().ctx.CREATE_KIND_ITEMS;
  assert.strictEqual(items.filter((it) => it.cls === 'Board').length, 1);
  assert.ok(items.filter((it) => it.cls === 'Mermaid').length > 8);
  assert.strictEqual(items.filter((it) => it.ready).map((it) => it.kind).join(','), 'board,flowchart');
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
  assert.strictEqual(t.els.createKindFilter.focused, true, 'focuses filter');
  assert.match(t.els.createKindList.innerHTML, /create-kind-label">Board/);
  assert.match(t.els.createKindList.innerHTML, /create-kind-label">Mermaid/);
  assert.match(t.els.createKindList.innerHTML, />Flowchart</);
  assert.match(t.els.createKindList.innerHTML, />Mindmap</);
  assert.doesNotMatch(t.els.createKindList.innerHTML, /Ready/);
  clickKind(t, 'board');
  assert.deepStrictEqual(picks, ['board']);
  assert.deepStrictEqual(cancels, []);
  assert.strictEqual(t.els.createKindDialog.hidden, true, 'closes after pick');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'flowchart');
  assert.deepStrictEqual(picks, ['flowchart']);
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'mindmap', true);
  assert.deepStrictEqual(picks, [], 'disabled mermaid types do not pick');
}

{
  const t = load();
  const cancels = [];
  t.ctx.openCreateKindDialog({ onCancel: () => cancels.push(1) });
  (t.docListeners.keydown || []).forEach((fn) => fn({ key: 'Escape', preventDefault() {} }));
  assert.deepStrictEqual(cancels, [1], 'Esc is onCancel');
}

{
  const t = load();
  const cancels = [];
  t.ctx.openCreateKindDialog({ onCancel: () => cancels.push(1) });
  t.ctx.closeCreateKindDialog();
  assert.deepStrictEqual(cancels, [1], 'close fires onCancel');
}

console.log('ok create-kind-dialog');
