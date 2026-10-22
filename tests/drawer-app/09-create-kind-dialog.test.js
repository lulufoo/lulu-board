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
assert.doesNotMatch(sheet, /shell-dialog-sheet/, 'create dialog does not reuse the small sign-in sheet');
assert.match(sheet, /id="createKindFilter"/, 'filter field');
assert.match(sheet, /<kbd>ESC<\/kbd>/, 'escape keycap is uppercase');
assert.match(sheet, /id="createKindList"/, 'type list');
assert.match(build, /06-confirm\.js[\s\S]*09-create-kind-dialog\.js/, 'dialog is in the drawer bundle');
assert.match(css, /\.create-kind-label/, 'two class headers live in CSS');
assert.match(css, /summary\.create-kind-label/, 'Mermaid header is a summary');
assert.match(css, /\.create-kind-note-rail/, 'Mermaid notes sit in a right rail');
assert.match(css, /\.create-kind-note-jump\s*\{[^}]*--ink-soft/, 'idle rail stays gray');
assert.match(css, /\.create-kind-note-jump\.is-current\s*\{[^}]*color-mix/, 'current rail is 10% deeper than the title');
assert.match(css, /\.create-kind-note-block\s*\{[^}]*border:/, 'notes reserve a frame');
assert.match(css, /--note-ink:\s*80,\s*55,\s*30/, 'note wash hue');
assert.match(css, /\.create-kind-note-block\.is-current[\s\S]{0,80}\.12/, 'current note deepens the frame');
assert.match(css, /\.create-kind-note-block\s*\{[^}]*background:/, 'notes share one wash');
assert.doesNotMatch(css, /\.create-kind-note-block:nth-child/);
assert.match(css, /\.create-kind-row:hover:not\(\.is-picked\)/, 'every row can hover');
assert.match(css, /\.create-kind-row:not\(:disabled\)[\s\S]{0,80}--accent/, 'ready names use the accent');
assert.match(css, /scrollbar-width: none/, 'list scrollbar is hidden');
assert.match(css, /justify-self: end/, 'note rail floats on the group');
assert.match(css, /position: sticky/, 'note rail sticks while the list scrolls');
assert.doesNotMatch(css, /content: "Expand"|content: "Collapse"/);
assert.match(js, /cls: "Board"/, 'Board class');
assert.match(js, /cls: "Mermaid"/, 'Mermaid class');
assert.match(js, /name: "Flowchart"/, 'lists flowchart');
assert.match(js, /name: "Mindmap"/, 'lists other mermaid types');
assert.doesNotMatch(js, /Ready/, 'no Ready badge');
assert.doesNotMatch(js + css, /create-kind-tag/, 'no per-row class tag');
assert.match(js, /noteRailPinned/, 'start stays on the first note');
assert.match(js, /Math\.abs\(\(els\.list\.scrollTop \|\| 0\) - noteRailLock\) < step/, 'one item of scroll releases the pin');
assert.match(js, /vis >= step/, 'a group shows once one item appears');
assert.doesNotMatch(js, /view\.top \+ step/, 'does not wait for the previous group to leave');
assert.match(js, /event\.key !== "Escape"/, 'Esc is cancel');
assert.doesNotMatch(js, /saveDiagramToHash|blankHashBoardSource|blankHashFlowchartSource|blankHashMindmapSource|diagramSourceEl/, 'does not write hash or source');

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
  assert.strictEqual(items.filter((it) => it.cls === 'Mermaid').length, 32);
  assert.strictEqual(items.length, 33);
  assert.strictEqual(items.filter((it) => it.ready).map((it) => it.kind).join(','), 'board,flowchart,mindmap,sequenceDiagram,classDiagram,stateDiagram,erDiagram,requirement,C4Context,usecase-beta,eventmodeling,railroad-beta');
  assert.strictEqual(items.filter((it) => it.name === 'Railroad').length, 1, 'Railroad is one create row');
  assert.strictEqual(items.filter((it) => it.name === 'C4').length, 1, 'C4 is one create row');
  const kinds = items.map((it) => it.kind);
  [
    'swimlane-beta', 'agentflow-beta', 'treeView-beta', 'usecase-beta',
    'eventmodeling', 'railroad-beta', 'cynefin-beta', 'wardley-beta',
    'venn-beta', 'ishikawa', 'treemap',
  ].forEach((kind) => {
    assert.ok(kinds.includes(kind), kind + ' is listed');
  });
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
  assert.match(t.els.createKindList.innerHTML, /data-create-kind-group="Mermaid"/);
  assert.match(t.els.createKindList.innerHTML, /create-kind-label">Mermaid/);
  ["Flow", "Chart", "Design", "Map", "Time"].forEach(function (note) {
    assert.match(t.els.createKindList.innerHTML, new RegExp('data-create-kind-note="' + note + '"'));
    assert.match(t.els.createKindList.innerHTML, new RegExp('data-create-kind-note-jump="' + note + '"'));
  });
  assert.doesNotMatch(t.els.createKindList.innerHTML, /data-create-kind-group="(chart|design|flow|map|time)"/);
  assert.doesNotMatch(t.els.createKindList.innerHTML, /<details[^>]* open/);
  assert.match(t.els.createKindList.innerHTML, /data-create-kind-note="Flow"[\s\S]*>Flowchart</);
  assert.match(t.els.createKindList.innerHTML, /data-create-kind-note="Flow"[\s\S]*data-create-kind-note="Chart"/);
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
  clickKind(t, 'mindmap');
  assert.deepStrictEqual(picks, ['mindmap'], 'Mindmap is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'sequenceDiagram');
  assert.deepStrictEqual(picks, ['sequenceDiagram'], 'Sequence is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'classDiagram');
  assert.deepStrictEqual(picks, ['classDiagram'], 'Class is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'stateDiagram');
  assert.deepStrictEqual(picks, ['stateDiagram'], 'State is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'erDiagram');
  assert.deepStrictEqual(picks, ['erDiagram'], 'ER is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'requirement');
  assert.deepStrictEqual(picks, ['requirement'], 'Requirement is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'C4Context');
  assert.deepStrictEqual(picks, ['C4Context'], 'C4 is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'eventmodeling');
  assert.deepStrictEqual(picks, ['eventmodeling'], 'Event Modeling is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'usecase-beta');
  assert.deepStrictEqual(picks, ['usecase-beta'], 'Use Case is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'railroad-beta');
  assert.deepStrictEqual(picks, ['railroad-beta'], 'Railroad is ready');
}

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  clickKind(t, 'gantt', true);
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

{
  const t = load();
  const picks = [];
  t.ctx.openCreateKindDialog({ onPick: (kind) => picks.push(kind) });
  const jump = {
    getAttribute(name) { return name === 'data-create-kind-note-jump' ? 'Chart' : null; },
    parentNode: t.els.createKindList,
  };
  (t.els.createKindList.listeners.click || []).forEach((fn) => fn({ target: jump }));
  assert.deepStrictEqual(picks, [], 'rail jump does not pick a type');
}

{
  const t = load();
  t.ctx.openCreateKindDialog({});
  assert.doesNotMatch(t.els.createKindList.innerHTML, /<details[^>]* open/, 'Mermaid starts collapsed');
  t.els.createKindFilter.value = 'mind';
  (t.els.createKindFilter.listeners.input || []).forEach((fn) => fn());
  assert.match(t.els.createKindList.innerHTML, /<details[^>]* open/, 'filter opens Mermaid');
  assert.match(t.els.createKindList.innerHTML, />Mindmap</);
}

console.log('ok create-kind-dialog');
