'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('packages/drawer-app/index.html');
const js = read('packages/drawer-app/js/09-shell-tabs.js');
const drawer = read('packages/drawer-app/js/09-shell-drawer.js');
const css = read('packages/drawer-app/css/09-shell-tabs.css');
const shellCss = read('packages/drawer-app/css/08-workspace-shell.css');
const build = read('scripts/drawer-app-build/build.mjs');

// markup: a tablist with Mine and Shared; Shared stays hidden until it is wired; no fold button
assert.match(html, /id="shellTabs" role="tablist"/);
assert.match(html, /id="shellTabMine"[^>]*role="tab"[^>]*aria-selected="true"[^>]*aria-controls="shellMine"/);
assert.match(html, /id="shellTabShared"[^>]*role="tab"[^>]*aria-selected="false"[^>]*aria-controls="shellShared"[^>]*hidden/);
assert.match(html, /class="shell-drawer-body" data-shell-tab="mine"/, 'Mine is the page the drawer opens on');
assert.match(html, /id="shellMine" role="tabpanel"/);
assert.match(html, /id="shellShared" role="tabpanel"/);
assert.doesNotMatch(html, /shellFold|shell-fold/, 'Shared no longer folds');
assert.doesNotMatch(drawer, /is-folded|shellFold/, 'the fold logic is gone');
assert.doesNotMatch(shellCss, /shell-fold|is-folded/, 'the fold rules are gone');

// built, and styled after the drawer sheet it overrides
assert.match(build, /'09-shell-drawer\.js',\s*'09-shell-tabs\.js'/);
assert.ok('09-shell-tabs.css' > '08-workspace-shell.css', 'the tabs sheet sorts after the shell sheet');
assert.match(css, /data-shell-tab="mine"\] #shellShared,[\s\S]*data-shell-tab="shared"\] #shellMine \{ display: none; \}/, 'one list at a time');
assert.match(css, /:not\(\[data-shell-tab="shared"\]\):has\(#shellSharedList \.is-current\) #shellTabShared span::after/, 'dot on Shared when the open board is shared');

// counts are numbers now (the tab already says what they count)
assert.match(drawer, /count\.textContent = rows\.length \? String\(rows\.length\) : ""/);
assert.match(drawer, /shellSyncTabs\(!section\.hidden\)/, 'Shared tab follows the Shared section');

// behaviour, on a tiny fake DOM
function fakeDom(search, sharedShownAtLoad) {
  const el = (id, attrs) => ({ id, hidden: false, tabIndex: 0, attrs: Object.assign({}, attrs), getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, focus() {}, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; } });
  const body = el('body', { 'data-shell-tab': 'mine' });
  const mine = el('shellTabMine', { 'data-shell-tab': 'mine', 'aria-selected': 'true' });
  const shared = el('shellTabShared', { 'data-shell-tab': 'shared', 'aria-selected': 'false' });
  shared.hidden = !sharedShownAtLoad;
  const bar = el('shellTabs');
  const byId = { shellTabs: bar, shellTabMine: mine, shellTabShared: shared };
  const doc = {
    getElementById: (id) => byId[id] || null,
    querySelector: (sel) => (sel === '.shell-drawer-body' ? body : null),
    querySelectorAll: (sel) => (sel === '.shell-tab' ? [mine, shared] : []),
  };
  const api = new Function('document', 'location', js + '\nreturn { shellSelectTab, shellSyncTabs, shellTabAvailable };')(doc, { search: search || '' });
  return Object.assign({ body, mine, shared, bar }, api);
}
{
  const d = fakeDom('');
  assert.strictEqual(d.shellTabAvailable('shared'), false, 'Shared is not available while hidden');
  d.shellSelectTab('shared');
  assert.strictEqual(d.body.getAttribute('data-shell-tab'), 'mine', 'a hidden Shared tab cannot be selected');
  d.shellSyncTabs(true);
  assert.strictEqual(d.shared.hidden, false, 'signed in: Shared tab shows');
  d.shellSelectTab('shared');
  assert.strictEqual(d.body.getAttribute('data-shell-tab'), 'shared');
  assert.strictEqual(d.shared.getAttribute('aria-selected'), 'true');
  assert.strictEqual(d.mine.getAttribute('aria-selected'), 'false');
  assert.strictEqual(d.mine.tabIndex, -1, 'roving tabindex');
  d.shellSyncTabs(false);
  assert.strictEqual(d.shared.hidden, true, 'signed out: Shared tab hides');
  assert.strictEqual(d.body.getAttribute('data-shell-tab'), 'mine', 'and the drawer falls back to Mine');
  // click on a tab switches
  d.shellSyncTabs(true);
  d.bar.listeners.click({ target: { closest: () => d.shared } });
  assert.strictEqual(d.body.getAttribute('data-shell-tab'), 'shared');
  // arrow keys move between the two tabs
  let prevented = false;
  d.bar.listeners.keydown({ key: 'ArrowLeft', preventDefault() { prevented = true; } });
  assert.strictEqual(d.body.getAttribute('data-shell-tab'), 'mine');
  assert.ok(prevented);
}
{
  // ?shared=open waits until Shared is shown, then selects it
  const d = fakeDom('?shared=open');
  assert.strictEqual(d.body.getAttribute('data-shell-tab'), 'mine');
  d.shellSyncTabs(true);
  assert.strictEqual(d.body.getAttribute('data-shell-tab'), 'shared');
  assert.strictEqual(d.body.getAttribute('data-shell-want'), null, 'the request is used once');
}
{
  // the drawer rendered Shared before the tabs were wired: the request is still honoured
  const d = fakeDom('?shared=open', true);
  assert.strictEqual(d.body.getAttribute('data-shell-tab'), 'shared');
}
{
  // no request: Mine stays selected even if Shared is already shown
  const d = fakeDom('?shell=drawer', true);
  assert.strictEqual(d.body.getAttribute('data-shell-tab'), 'mine');
}
console.log('ok 09-shell-tabs');
