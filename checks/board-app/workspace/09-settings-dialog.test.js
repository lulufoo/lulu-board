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
const tokensJs = read('packages/board-app/workspace/src/cloud/cloud-tokens.js');
const preferenceJs = read('packages/board-app/workspace/src/core/webmcp-preference.js');
const css = read('packages/board-app/workspace/css/09-settings-dialog.css');
const shareCss = read('packages/board-app/workspace/css/09-share-dialog.css');
const main = read('packages/board-app/workspace/src/main.js');

const sheet = html.slice(html.indexOf('id="settingsDialog"'), html.indexOf('id="createKindDialog"'));
assert.match(sheet, /role="dialog" aria-modal="true" aria-labelledby="settingsDialogTitle"/);
assert.match(sheet, />Settings</);
assert.match(sheet, /Make Board work your way\./);
assert.match(sheet, /role="tablist"[\s\S]*>General<[\s\S]*>Access tokens</);
assert.match(sheet, /role="switch" aria-checked="false"/);
assert.match(sheet, /id="settingsDialogBackdrop"[^>]*tabindex="-1"/);
assert.match(sheet, /Enable WebMCP[\s\S]*Let AI read and edit the Board you have open\./);
assert.match(sheet, /Available for cloud diagrams you can edit\./);
assert.match(sheet, /Personal access tokens/);
assert.match(sheet, /Generate token/);
assert.match(sheet, /7 days[\s\S]*30 days[\s\S]*90 days/);
assert.match(sheet, /Access: read your diagrams by ID/);
assert.match(sheet, /You won't be able to see it again/);
assert.match(sheet, /Revoke anytime/);
assert.doesNotMatch(sheet, /go back|返回|back-arrow|settings-back/i);
assert.match(sheet, /class="shell-dialog-sheet settings-sheet"/);
assert.match(shareCss, /min\(528px, 100%\)/);
assert.match(css, /settings-sheet/);
assert.match(css, /width: min\(528px, 100%\)/);
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
    || part === '[hidden]' && node.hidden
    || part === '[tabindex]' && node.getAttribute('tabindex') !== null
    || part.toUpperCase() === node.tagName
  ));
}

function makeEl(id, doc, tag = 'div') {
  const attrs = {};
  const children = [];
  const classes = new Set();
  const el = {
    id, tagName: tag.toUpperCase(), tabIndex: /^(button|input)$/.test(tag) ? 0 : -1,
    hidden: false, disabled: false, textContent: '', value: '', type: '', listeners: {}, children,
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
      if (doc && children.some((child) => child === doc.activeElement || descendants(child).includes(doc.activeElement))) doc.activeElement = doc.body;
      children.forEach((c) => { if (c) c.parentNode = null; });
      children.length = 0;
      for (let i = 0; i < arguments.length; i += 1) {
        children.push(arguments[i]);
        if (arguments[i]) arguments[i].parentNode = el;
      }
    },
    querySelector(sel) { return descendants(el).find((n) => matchSel(n, sel)) || null; },
    querySelectorAll(sel) { return descendants(el).filter((n) => matchSel(n, sel)); },
    contains(node) { return node === el || descendants(el).includes(node); },
    closest(sel) { let n = el; while (n) { if (matchSel(n, sel)) return n; n = n.parentNode; } return null; },
    setPointerCapture() {},
    focus() { if (doc) doc.activeElement = this; },
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
    'settingsTabGeneral', 'settingsTabTokens', 'settingsPanelGeneral', 'settingsPanelTokens',
    'settingsWebMcpSwitch', 'settingsPreferenceNotice', 'settingsTokenResultSub', 'btnShellSettings',
  ];
  const els = {};
  const doc = { activeElement: null };
  doc.body = makeEl('body', doc, 'body');
  doc.activeElement = doc.body;
  ids.forEach((id) => {
    const button = /^(btnShell|settingsTab|settingsWebMcpSwitch|settingsDialogClose|settingsDialogBackdrop|settingsGenerateOpen|settingsGenerateClose|settingsGenerateSubmit|settingsCopyToken|settingsResultDone)/.test(id);
    els[id] = makeEl(id, doc, button ? 'button' : id === 'settingsTokenName' ? 'input' : 'div');
  });
  els.settingsDialog.hidden = true;
  els.settingsDialogBackdrop.tabIndex = -1;
  els.settingsDialogTitle.textContent = 'Settings';
  els.settingsPanelTokens.hidden = true;
  els.settingsPaneGenerate.hidden = true;
  els.settingsPaneResult.hidden = true;
  const dayBtns = [7, 30, 90].map((days) => {
    const b = makeEl('days-' + days, doc, 'button');
    b.setAttribute('data-settings-days', String(days));
    b.setAttribute('aria-checked', days === 30 ? 'true' : 'false');
    return b;
  });
  const calls = [];
  const copied = [];
  const docListeners = {};
  const stored = new Map(opts.stored == null ? [] : [['drawer.webmcp.enabled', opts.stored]]);
  const writes = [];
  const storage = {
    getItem(key) { if (opts.failRead) throw new Error('blocked'); return stored.get(key) ?? null; },
    setItem(key, value) { if (opts.failWrite) throw new Error('quota'); writes.push([key, value]); stored.set(key, value); },
  };
  [els.settingsDialogBackdrop, els.settingsDialogClose, els.settingsTabGeneral, els.settingsTabTokens, els.settingsPanelGeneral, els.settingsPanelTokens].forEach(el => els.settingsDialog.appendChild(el));
  els.settingsPanelGeneral.appendChild(els.settingsWebMcpSwitch);
  [els.settingsPaneList, els.settingsPaneGenerate, els.settingsPaneResult].forEach(el => els.settingsPanelTokens.appendChild(el));
  [els.settingsGenerateOpen, els.settingsTokenList].forEach(el => els.settingsPaneList.appendChild(el));
  [els.settingsTokenName, ...dayBtns, els.settingsGenerateClose, els.settingsGenerateSubmit].forEach(el => els.settingsPaneGenerate.appendChild(el));
  [els.settingsTokenValue, els.settingsCopyToken, els.settingsResultDone].forEach(el => els.settingsPaneResult.appendChild(el));
  const ctx = {
    document: Object.assign(doc, {
      getElementById: (id) => els[id] || null,
      querySelectorAll: (sel) => (sel === '[data-settings-days]' ? dayBtns : []),
      addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
      createElement: (tag) => makeEl(tag, doc, tag),
      createTextNode: (text) => ({ textContent: String(text), nodeType: 3 }),
    }),
    localStorage: storage,
    location: { search: opts.search || '' },
    navigator: { clipboard: { writeText: async (text) => { copied.push(text); } } },
    window: {}, setTimeout(fn) { fn(); }, console,
    register() {},
    call(name) { if (name === 'shellIsPreview') return !!opts.preview; },
    cloudListTokens: async () => { calls.push({ op: 'list' }); return opts.list || []; },
    cloudCreateToken: async (name, days) => {
      calls.push({ op: 'create', name, days });
      if (opts.failCreate) throw new Error('create failed');
      return opts.createResult || { meta: { id: 'n1', name, prefix: 'lbp_6a2f' }, token: 'lbp_' + 'ab'.repeat(32) };
    },
    cloudRevokeToken: async (id) => { calls.push({ op: 'revoke', id }); return opts.revokeResult; },
    setStatus() {},
  };
  vm.createContext(ctx);
  const script = [preferenceJs, rowJs, dialogJs].join('\n')
    .replace(/^import \{[\s\S]*?\} from ['"][^'"]+['"];\n/gm, '')
    .replace(/^import .*$/gm, '')
    .replace(/^export \{[\s\S]*?\};/gm, '')
    .replace(/^export (async )?function /gm, '$1function ')
    .replace(/^export (var|const) /gm, '$1 ');
  vm.runInContext(script + '\nthis.api = { settingsOpen, settingsClose, settingsOpenGenerate, settingsCreate, settingsCopy, settingsPrefixLabel };', ctx);
  return { ctx, els, dayBtns, calls, copied, api: ctx.api, docListeners, writes, stored };
}
const tick = () => new Promise((r) => setImmediate(r));
async function openTokens(t) {
  t.api.settingsOpen();
  t.els.settingsTabTokens.click();
  await tick();
}
function key(t, node, name, shiftKey = false) {
  let prevented = false;
  const event = { key: name, shiftKey, preventDefault() { prevented = true; }, stopPropagation() {} };
  (node ? node.listeners.keydown || [] : t.docListeners.keydown || []).forEach(fn => fn(event));
  return prevented;
}

(async () => {
  {
    const t = load({ preview: false });
    t.api.settingsOpen(); await tick();
    assert.strictEqual(t.els.settingsPanelGeneral.hidden, false);
    assert.strictEqual(t.els.settingsPanelTokens.hidden, true);
    assert.strictEqual(t.els.settingsTabGeneral.getAttribute('aria-selected'), 'true');
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsTabGeneral);
    assert.deepStrictEqual(t.calls, [], 'General opens without requesting personal tokens');
    assert.strictEqual(t.els.settingsWebMcpSwitch.getAttribute('aria-checked'), 'true');
    t.els.settingsWebMcpSwitch.click();
    assert.strictEqual(t.els.settingsWebMcpSwitch.getAttribute('aria-checked'), 'false');
    assert.deepStrictEqual(t.writes, [['drawer.webmcp.enabled', 'false']], 'only the preference boolean is stored');
    t.els.settingsDialogClose.click();
    assert.strictEqual(t.ctx.document.activeElement, t.els.btnShellSettings);
    t.api.settingsOpen();
    assert.strictEqual(t.els.settingsWebMcpSwitch.getAttribute('aria-checked'), 'false');
    const refreshed = load({ preview: false, stored: t.stored.get('drawer.webmcp.enabled') });
    assert.strictEqual(refreshed.els.settingsWebMcpSwitch.getAttribute('aria-checked'), 'false', 'the first paint restores off');
  }
  {
    const t = load({ preview: true });
    t.api.settingsOpen();
    assert.strictEqual(key(t, t.els.settingsTabGeneral, 'ArrowRight'), true);
    assert.strictEqual(t.els.settingsPanelTokens.hidden, false);
    assert.strictEqual(t.els.settingsTabGeneral.tabIndex, -1);
    assert.strictEqual(t.els.settingsTabTokens.tabIndex, 0);
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsTabTokens);
    key(t, t.els.settingsTabTokens, 'Home');
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsTabGeneral);
    key(t, t.els.settingsTabGeneral, 'End');
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsTabTokens);
    key(t, t.els.settingsTabTokens, 'ArrowLeft');
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsTabGeneral);
    t.els.settingsWebMcpSwitch.focus();
    assert.strictEqual(key(t, null, 'Tab'), true);
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsDialogClose);
    assert.notStrictEqual(t.ctx.document.activeElement, t.els.settingsDialogBackdrop, 'the real backdrop never enters the keyboard loop');
    assert.strictEqual(key(t, null, 'Tab', true), true);
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsWebMcpSwitch);
    key(t, null, 'Escape');
    assert.strictEqual(t.els.settingsDialog.hidden, true);
    assert.strictEqual(t.ctx.document.activeElement, t.els.btnShellSettings);
    t.api.settingsOpen();
    assert.strictEqual(t.els.settingsPanelGeneral.hidden, false, 'every open starts on General');
  }
  {
    const t = load({ preview: true, failRead: true, failWrite: true });
    t.api.settingsOpen();
    assert.strictEqual(t.els.settingsWebMcpSwitch.getAttribute('aria-checked'), 'false');
    assert.match(t.els.settingsPreferenceNotice.textContent, /could not load/);
    assert.doesNotThrow(() => t.els.settingsWebMcpSwitch.click());
    assert.strictEqual(t.els.settingsWebMcpSwitch.getAttribute('aria-checked'), 'true', 'storage failure does not block a current-tab choice');
    assert.match(t.els.settingsPreferenceNotice.textContent, /Changed for this tab/);
    await openTokens(t);
    assert.ok(t.els.settingsTokenList.children.length, 'PAT editing still works when preference storage is unavailable');
  }
  {
    const t = load({ preview: true });
    await openTokens(t);
    t.api.settingsOpenGenerate();
    t.els.settingsTokenName.value = 'Keep this draft';
    t.els.settingsTabGeneral.click();
    t.els.settingsTabTokens.click();
    assert.strictEqual(t.els.settingsTokenName.value, 'Keep this draft');
    assert.strictEqual(t.els.settingsPaneGenerate.hidden, false);
    await t.api.settingsCreate();
    const plain = t.els.settingsTokenValue.textContent;
    t.els.settingsTabGeneral.click();
    t.els.settingsTabTokens.click();
    assert.strictEqual(t.els.settingsPaneResult.hidden, false);
    assert.strictEqual(t.els.settingsTokenValue.textContent, plain, 'tab switches retain the one-time result');
    assert.deepStrictEqual(t.writes, [], 'token creation never writes browser storage');
    t.els.settingsResultDone.click();
    assert.strictEqual(t.els.settingsDialog.hidden, true, 'Done retains the existing exit behavior');
    assert.strictEqual(t.els.settingsTokenValue.textContent, '');
    assert.strictEqual(t.ctx.document.activeElement, t.els.btnShellSettings);
  }
  {
    let finish;
    const t = load({ preview: false, createResult: new Promise(resolve => { finish = resolve; }) });
    await openTokens(t);
    t.api.settingsOpenGenerate();
    t.els.settingsTokenName.value = 'Slow token';
    const pending = t.api.settingsCreate();
    t.els.settingsTabGeneral.click();
    finish({ token: 'lbp_secret' });
    await pending;
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsTabGeneral, 'finishing a hidden PAT pane does not steal focus');
    t.els.settingsTabTokens.click();
    assert.strictEqual(t.els.settingsTokenValue.textContent, 'lbp_secret');
  }
  {
    let finish;
    const t = load({ preview: false, createResult: new Promise(resolve => { finish = resolve; }) });
    await openTokens(t);
    t.api.settingsOpenGenerate();
    t.els.settingsTokenName.value = 'Closed token';
    const pending = t.api.settingsCreate();
    t.api.settingsClose();
    t.api.settingsOpen();
    finish({ token: 'lbp_should_not_reappear' });
    await pending;
    assert.strictEqual(t.els.settingsTokenValue.textContent, '', 'an old request cannot put plaintext into a reopened dialog');
    assert.strictEqual(t.els.settingsPanelGeneral.hidden, false);
    assert.strictEqual(t.els.settingsPaneResult.hidden, true);
  }
  {
    const t = load({ preview: true });
    await openTokens(t);
    assert.strictEqual(t.els.settingsDialog.hidden, false);
    assert.strictEqual(t.els.settingsPaneList.hidden, false);
    assert.match(t.els.settingsTokenList.children[0].className, /settings-token/);
    t.api.settingsOpenGenerate();
    assert.strictEqual(t.els.settingsPaneGenerate.hidden, false);
    assert.strictEqual(t.els.settingsPaneList.hidden, true);
    assert.strictEqual(t.els.settingsDialogTitle.textContent, 'Settings', 'the dialog keeps its Settings heading');
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
    await openTokens(t);
    assert.strictEqual(t.els.settingsPaneList.hidden, false, 'reopening tokens starts on the list');
    assert.strictEqual(t.els.settingsPaneResult.hidden, true);
  }
  {
    const t = load({ preview: true });
    await openTokens(t);
    t.api.settingsOpenGenerate();
    t.els.settingsGenerateClose.click();
    assert.strictEqual(t.els.settingsDialog.hidden, true, 'Close on the form exits the dialog');
  }
  {
    const t = load({ preview: false, list: [{ id: 't1', name: 'Spark — Mac', prefix: 'lbp_6a2f', expires_at: '2026-12-10T00:00:00Z' }] });
    await openTokens(t);
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
    await openTokens(t);
    t.api.settingsOpenGenerate();
    t.els.settingsTokenName.value = 'CI';
    await t.api.settingsCreate(); await tick();
    assert.strictEqual(t.els.settingsPaneGenerate.hidden, false, 'a failed generate stays on the form');
    assert.match(t.els.settingsError.textContent, /create failed/);
  }
  {
    const t = load({ preview: true });
    await openTokens(t);
    t.api.settingsOpenGenerate();
    t.docListeners.keydown.forEach((fn) => fn({ key: 'Escape', stopPropagation() {}, preventDefault() {} }));
    assert.strictEqual(t.els.settingsDialog.hidden, true, 'Escape closes the dialog');
  }
  {
    const t = load({ preview: true });
    await openTokens(t);
    const card = t.els.settingsTokenList.children[0];
    const reveal = findClass(card, 'settings-text-btn');
    const action = findClass(card, 'settings-token-action');
    assert.ok(reveal && action, 'row has reveal and trailing revoke');
    reveal.click();
    assert.ok(card.classList.contains('is-armed'), 'clicking Revoke reveals the rail');
    assert.match(card.className, /settings-token/, 'arming does not remove the row');
    t.docListeners.pointerdown.forEach((fn) => fn({ target: action }));
    assert.ok(card.classList.contains('is-armed'), 'pointerdown on the red rail stays armed');
    t.docListeners.pointerdown.forEach((fn) => fn({ target: findClass(card, 'settings-token-body') }));
    assert.ok(!card.classList.contains('is-armed'), 'a tap on the row body closes the rail');
    reveal.click();
    t.docListeners.pointerdown.forEach((fn) => fn({ target: { closest() { return null; } } }));
    assert.ok(!card.classList.contains('is-armed'), 'a tap elsewhere closes the rail');
    reveal.click();
    t.docListeners.keydown.forEach((fn) => fn({ key: 'Escape', stopPropagation() {}, preventDefault() {} }));
    assert.strictEqual(t.els.settingsDialog.hidden, false, 'Escape first closes the rail');
    assert.ok(!card.classList.contains('is-armed'));
    reveal.click();
    action.click(); await tick();
    assert.strictEqual(t.els.settingsTokenList.querySelectorAll('.settings-token').length, 1, 'the trailing Revoke deletes that token');
  }
  {
    const t = load({ preview: false, list: [{ id: 't1', name: 'CI bot', prefix: 'lbp_abcd', expires_at: '2026-12-10T00:00:00Z' }] });
    await openTokens(t);
    const card = t.els.settingsTokenList.children[0];
    findClass(card, 'settings-text-btn').click();
    assert.deepStrictEqual(t.calls, [{ op: 'list' }], 'sliding open does not revoke');
    findClass(card, 'settings-token-action').click(); await tick();
    assert.deepStrictEqual(t.calls[1], { op: 'revoke', id: 't1' });
  }
  {
    const t = load({ preview: true });
    await openTokens(t);
    while (t.els.settingsTokenList.querySelectorAll('.settings-token').length) {
      const card = t.els.settingsTokenList.querySelectorAll('.settings-token')[0];
      findClass(card, 'settings-text-btn').click();
      const action = findClass(card, 'settings-token-action');
      assert.strictEqual(t.ctx.document.activeElement, action);
      action.click(); await tick();
      assert.strictEqual(t.ctx.document.activeElement.id, 'settingsGenerateOpen', 'removing the focused revoke control restores focus to the visible list toolbar, including the empty state');
    }
    t.ctx.document.body.focus();
    assert.strictEqual(key(t, null, 'Tab'), true);
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsDialogClose, 'Tab recovers an escaped focus into the modal');
    t.ctx.document.body.focus();
    assert.strictEqual(key(t, null, 'Tab', true), true);
    assert.strictEqual(t.ctx.document.activeElement, t.els.settingsGenerateOpen, 'Shift-Tab recovers to the last visible modal control');
  }
  for (const destination of ['general', 'closed']) {
    let finish;
    const t = load({
      preview: false,
      list: [{ id: 't1', name: 'CI bot', prefix: 'lbp_abcd', expires_at: '2026-12-10T00:00:00Z' }],
      revokeResult: new Promise(resolve => { finish = resolve; }),
    });
    await openTokens(t);
    const card = t.els.settingsTokenList.querySelectorAll('.settings-token')[0];
    findClass(card, 'settings-text-btn').click();
    findClass(card, 'settings-token-action').click();
    if (destination === 'general') t.els.settingsTabGeneral.click();
    else t.api.settingsClose();
    const active = t.ctx.document.activeElement;
    finish(); await tick();
    assert.strictEqual(t.ctx.document.activeElement, active, 'a late revoke does not steal focus after ' + destination);
  }
  console.log('ok 09-settings-dialog');
})().catch((e) => { console.error(e); process.exit(1); });
