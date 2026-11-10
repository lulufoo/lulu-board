import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('packages/board-app/workspace/index.html');
const drawer = read('packages/board-app/workspace/src/chrome/shell-drawer.js');
const dialogJs = read('packages/board-app/workspace/src/chrome/settings-dialog.js');
const rowJs = read('packages/board-app/workspace/src/chrome/settings-token-row.js');
const swipeJs = read('packages/board-app/workspace/src/chrome/settings-token-swipe.js');
const tokensJs = read('packages/board-app/workspace/src/cloud/cloud-tokens.js');
const css = read('packages/board-app/workspace/css/09-settings-dialog.css');
const shareCss = read('packages/board-app/workspace/css/09-share-dialog.css');
const main = read('packages/board-app/workspace/src/main.js');

const sheet = html.slice(html.indexOf('id="settingsDialog"'), html.indexOf('id="createKindDialog"'));
assert.match(sheet, /role="dialog" aria-modal="true" aria-labelledby="settingsDialogTitle"/);
assert.match(sheet, />Settings</);
assert.match(sheet, /Manage access to Board/);
assert.match(sheet, /Personal access tokens/);
assert.match(sheet, /Generate token/);
assert.match(sheet, /7 days[\s\S]*30 days[\s\S]*90 days/);
assert.match(sheet, /Access: read your diagrams by ID/);
assert.match(sheet, /You won't be able to see it again/);
assert.match(sheet, /Swipe left to revoke/);
assert.doesNotMatch(sheet, /go back|返回|back-arrow|settings-back/i);
assert.match(sheet, /class="shell-dialog-sheet settings-sheet"/);
assert.match(shareCss, /min\(528px, 100%\)/);
assert.match(css, /settings-sheet/);
assert.match(css, /settings-token-action/);
assert.match(css, /\.settings-token \{[^}]*align-items: center/);
assert.match(css, /is-armed \.settings-token-action \{ transform: translateX\(0\)/);
assert.match(css, /is-armed \.settings-text-btn \{ visibility: hidden/);
assert.match(css, /\.settings-code \.settings-text-btn \{[^}]*white-space: nowrap/);
assert.match(read('packages/board-app/workspace/css/06-sign-in.css'), /#confirmDialog \{ z-index: 190/);
assert.match(main, /settings-dialog\.js/);
assert.match(drawer, /emit\("settingsDialogOpen"/);
assert.match(dialogJs, /settings-token-row\.js/);
assert.doesNotMatch(dialogJs, /askConfirm/);
assert.doesNotMatch(dialogJs + tokensJs, /localStorage|sessionStorage/);
assert.doesNotMatch(tokensJs, /token_hash/);
assert.match(tokensJs, /https:\/\/api\.luluboard\.app' \+ path/);
assert.match(tokensJs, /tokenRequest\('\/tokens'/);

function descendants(node) {
  const out = [];
  (node.children || []).forEach((c) => { out.push(c); descendants(c).forEach((d) => out.push(d)); });
  return out;
}

function matchSel(node, sel) {
  if (!node || !node.classList) return false;
  return String(sel || '').split(',').map((s) => s.trim()).filter(Boolean).some((part) => (
    part.startsWith('.') && node.classList.contains(part.slice(1))
  ));
}

function makeEl(id) {
  const attrs = {};
  const children = [];
  const classes = new Set();
  const el = {
    id, hidden: false, disabled: false, textContent: '', value: '', type: '', listeners: {}, children,
    style: {}, parentNode: null,
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v || '').split(/\s+/).filter(Boolean).forEach((c) => classes.add(c)); },
    classList: {
      add(...names) { names.forEach((n) => classes.add(n)); },
      remove(...names) { names.forEach((n) => classes.delete(n)); },
      toggle(name, on) { if (on === undefined) { if (classes.has(name)) classes.delete(name); else classes.add(name); } else if (on) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k] === undefined ? null : attrs[k]; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    appendChild(node) { children.push(node); if (node) node.parentNode = el; return node; },
    replaceChildren() {
      children.forEach((c) => { if (c) c.parentNode = null; });
      children.length = 0;
      for (let i = 0; i < arguments.length; i += 1) {
        children.push(arguments[i]);
        if (arguments[i]) arguments[i].parentNode = el;
      }
    },
    querySelector(sel) { return descendants(el).find((n) => matchSel(n, sel)) || null; },
    querySelectorAll(sel) { return descendants(el).filter((n) => matchSel(n, sel)); },
    closest(sel) { let n = el; while (n) { if (matchSel(n, sel)) return n; n = n.parentNode; } return null; },
    setPointerCapture() {},
    focus() {},
    click() { (this.listeners.click || []).forEach((f) => f({ target: this, stopPropagation() {} })); },
  };
  return el;
}

function findClass(node, name) {
  if (node.classList && node.classList.contains(name)) return node;
  for (let i = 0; i < (node.children || []).length; i += 1) {
    const hit = findClass(node.children[i], name);
    if (hit) return hit;
  }
  return null;
}

function load(opts) {
  const ids = [
    'settingsDialog', 'settingsDialogBackdrop', 'settingsDialogTitle', 'settingsDialogSub', 'settingsDialogClose',
    'settingsError', 'settingsPaneList', 'settingsPaneGenerate', 'settingsPaneResult', 'settingsGenerateOpen',
    'settingsTokenList', 'settingsTokenName', 'settingsGenerateClose', 'settingsGenerateSubmit',
    'settingsTokenValue', 'settingsCopyToken', 'settingsResultDone',
  ];
  const els = {};
  ids.forEach((id) => { els[id] = makeEl(id); });
  els.settingsDialog.hidden = true;
  els.settingsPaneGenerate.hidden = true;
  els.settingsPaneResult.hidden = true;
  const dayBtns = [7, 30, 90].map((days) => {
    const b = makeEl('days-' + days);
    b.setAttribute('data-settings-days', String(days));
    b.setAttribute('aria-checked', days === 30 ? 'true' : 'false');
    return b;
  });
  const calls = [];
  const copied = [];
  const docListeners = {};
  const ctx = {
    document: {
      getElementById: (id) => els[id] || null,
      querySelectorAll: (sel) => (sel === '[data-settings-days]' ? dayBtns : []),
      addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
      createElement: (tag) => makeEl(tag),
      createTextNode: (text) => ({ textContent: String(text), nodeType: 3 }),
    },
    location: { search: opts.search || '' },
    navigator: { clipboard: { writeText: async (text) => { copied.push(text); } } },
    window: {}, setTimeout(fn) { fn(); }, console,
    register() {},
    call(name) { if (name === 'shellIsPreview') return !!opts.preview; },
    cloudListTokens: async () => { calls.push({ op: 'list' }); return opts.list || []; },
    cloudCreateToken: async (name, days) => {
      calls.push({ op: 'create', name, days });
      if (opts.failCreate) throw new Error('create failed');
      return { meta: { id: 'n1', name, prefix: 'lbp_6a2f' }, token: 'lbp_' + 'ab'.repeat(32) };
    },
    cloudRevokeToken: async (id) => { calls.push({ op: 'revoke', id }); },
    setStatus() {},
  };
  vm.createContext(ctx);
  const script = [swipeJs, rowJs, dialogJs].join('\n')
    .replace(/^import \{[\s\S]*?\} from ['"][^'"]+['"];\n/gm, '')
    .replace(/^import .*$/gm, '')
    .replace(/^export \{[\s\S]*?\};/gm, '')
    .replace(/^export (async )?function /gm, '$1function ')
    .replace(/^export var /gm, 'var ');
  vm.runInContext(script + '\nthis.api = { settingsOpen, settingsClose, settingsOpenGenerate, settingsCreate, settingsCopy, settingsPrefixLabel };', ctx);
  return { ctx, els, dayBtns, calls, copied, api: ctx.api, docListeners };
}
const tick = () => new Promise((r) => setImmediate(r));

(async () => {
  {
    const t = load({ preview: true });
    t.api.settingsOpen(); await tick();
    assert.strictEqual(t.els.settingsDialog.hidden, false);
    assert.strictEqual(t.els.settingsPaneList.hidden, false);
    assert.match(t.els.settingsTokenList.children[0].className, /settings-token/);
    t.api.settingsOpenGenerate();
    assert.strictEqual(t.els.settingsPaneGenerate.hidden, false);
    assert.strictEqual(t.els.settingsPaneList.hidden, true);
    assert.strictEqual(t.els.settingsDialogTitle.textContent, 'Generate personal access token');
    t.els.settingsTokenName.value = 'Spark — Mac';
    await t.api.settingsCreate(); await tick();
    assert.strictEqual(t.els.settingsPaneResult.hidden, false);
    assert.match(t.els.settingsTokenValue.textContent, /^lbp_[0-9a-f]{64}$/);
    await t.api.settingsCopy();
    assert.strictEqual(t.copied[0], t.els.settingsTokenValue.textContent);
    assert.strictEqual(t.els.settingsPaneResult.hidden, false, 'Copy stays on the result pane');
    t.api.settingsClose();
    assert.strictEqual(t.els.settingsDialog.hidden, true);
    assert.strictEqual(t.els.settingsTokenValue.textContent, '');
    t.api.settingsOpen(); await tick();
    assert.strictEqual(t.els.settingsPaneList.hidden, false, 'reopen starts on the list');
    assert.strictEqual(t.els.settingsPaneResult.hidden, true);
  }
  {
    const t = load({ preview: true });
    t.api.settingsOpen(); await tick();
    t.api.settingsOpenGenerate();
    t.els.settingsGenerateClose.click();
    assert.strictEqual(t.els.settingsDialog.hidden, true, 'Close on the form exits the dialog');
  }
  {
    const t = load({ preview: false, list: [{ id: 't1', name: 'Spark — Mac', prefix: 'lbp_6a2f', expires_at: '2026-12-10T00:00:00Z' }] });
    t.api.settingsOpen(); await tick();
    assert.deepStrictEqual(t.calls[0], { op: 'list' });
    assert.strictEqual(t.api.settingsPrefixLabel('lbp_6a2f'), 'lbp_····6a2f');
    t.api.settingsOpenGenerate();
    t.els.settingsTokenName.value = 'CI';
    await t.api.settingsCreate(); await tick();
    assert.deepStrictEqual(t.calls[1], { op: 'create', name: 'CI', days: 30 });
    assert.match(t.els.settingsTokenValue.textContent, /^lbp_/);
  }
  {
    const t = load({ preview: false, failCreate: true, list: [] });
    t.api.settingsOpen(); await tick();
    t.api.settingsOpenGenerate();
    t.els.settingsTokenName.value = 'CI';
    await t.api.settingsCreate(); await tick();
    assert.strictEqual(t.els.settingsPaneGenerate.hidden, false, 'a failed generate stays on the form');
    assert.match(t.els.settingsError.textContent, /create failed/);
  }
  {
    const t = load({ preview: true });
    t.api.settingsOpen(); await tick();
    t.api.settingsOpenGenerate();
    t.docListeners.keydown.forEach((fn) => fn({ key: 'Escape', stopPropagation() {} }));
    assert.strictEqual(t.els.settingsDialog.hidden, true, 'Escape closes the dialog');
  }
  {
    const t = load({ preview: true });
    t.api.settingsOpen(); await tick();
    const card = t.els.settingsTokenList.children[0];
    const reveal = findClass(card, 'settings-text-btn');
    const action = findClass(card, 'settings-token-action');
    assert.ok(reveal && action, 'row has reveal and trailing revoke');
    reveal.click();
    assert.ok(card.classList.contains('is-armed'), 'Revoke slides the row open');
    assert.match(card.className, /settings-token/, 'arming does not remove the row');
    t.docListeners.pointerdown.forEach((fn) => fn({ target: { closest() { return null; } } }));
    assert.ok(!card.classList.contains('is-armed'), 'a tap elsewhere closes the rail');
    reveal.click();
    t.docListeners.keydown.forEach((fn) => fn({ key: 'Escape', stopPropagation() {} }));
    assert.strictEqual(t.els.settingsDialog.hidden, false, 'Escape first closes the rail');
    assert.ok(!card.classList.contains('is-armed'));
    reveal.click();
    action.click(); await tick();
    assert.strictEqual(t.els.settingsTokenList.querySelectorAll('.settings-token').length, 1, 'the trailing Revoke deletes that token');
  }
  {
    const t = load({ preview: false, list: [{ id: 't1', name: 'CI bot', prefix: 'lbp_abcd', expires_at: '2026-12-10T00:00:00Z' }] });
    t.api.settingsOpen(); await tick();
    const card = t.els.settingsTokenList.children[0];
    findClass(card, 'settings-text-btn').click();
    assert.deepStrictEqual(t.calls, [{ op: 'list' }], 'sliding open does not revoke');
    findClass(card, 'settings-token-action').click(); await tick();
    assert.deepStrictEqual(t.calls[1], { op: 'revoke', id: 't1' });
  }
  console.log('ok 09-settings-dialog');
})().catch((e) => { console.error(e); process.exit(1); });
