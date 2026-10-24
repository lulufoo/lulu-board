'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const appBuild = read('scripts/drawer-app-build/build.mjs');
const cloud = read('packages/drawer-app/js/06-cloud-sync.js');
const tabs = read('packages/drawer-app/js/06-cloud-group-tabs.js');
const tabCss = read('packages/drawer-app/css/06-group-tabs.css');
const chromeCss = read('packages/drawer-app/css/02-chrome.css');
const dockCss = read('packages/drawer-app/css/03-diagram.css');
const boardJs = read('packages/drawer-app/js/02-diagram.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');

assert.match(html, /id="diagram-group-tabs"/, 'canvas keeps a group tab strip');
assert.match(appBuild, /06-cloud-group-tabs\.js/, 'drawer app concatenates group tab chrome');
assert.match(appBuild, /06-confirm\.js/, 'drawer app concatenates the in-app confirm');
assert.match(html, /id="confirmDialog"/, 'canvas keeps one in-app confirm');
assert.match(chromeCss, /\.zoom-float \{[\s\S]*left: 50%;/, 'zoom / type sit at the bottom center');
assert.match(html, /id="zoom-kind-label"/, 'zoom chrome shows the diagram type');
assert.doesNotMatch(html, /id="btnFit"/, 'zoom chrome has no Fit button');
assert.match(chromeCss, /show-chrome \.zoom-float/, 'zoom chrome still appears after a zoom change');
assert.doesNotMatch(tabCss, /right: 88px/, 'group tabs do not shove zoom left');
assert.doesNotMatch(dockCss, /\.zoom-float \{ right: 88px/, 'dock css does not shove zoom left');
assert.match(tabCss, /\.group-tab-float/, 'group tabs are canvas chrome');
assert.match(tabCss, /flex-direction: column/, 'group tabs stack vertically');
assert.match(tabCss, /z-index: 4/, 'open dock covers the tab strip');
assert.match(tabs, /cloudStartPlusDraft/, 'plus starts a local draft');
assert.match(tabs, /openCreateKindDialog/, 'plus opens the kind dialog before writing');
assert.match(tabs, /applyCreateKindPick/, 'plus kind pick including Welcome uses the shared commit');
assert.match(tabs, /shellCloseDrawer/, 'picking a type from plus closes the left drawer');
assert.match(tabs, /loadKindTemplateSource\(kind\)/, 'plus fetches the built-in template');
assert.doesNotMatch(tabs, /blankHashSourceForKind/, 'plus does not use the JS seed');
assert.match(tabs, /onCancel: function \(\) \{\}/, 'plus cancel does not create a draft');
assert.match(tabs, /saveDiagramToHash/, 'plus writes a blank #z: envelope');
assert.match(tabs, /cloudGroupMembers\.length \+ 1/, 'plus shows the next numbered tab');
assert.match(tabs, /plus\.disabled = !!cloudPlusDraft/, 'plus stays disabled until the draft is saved');
assert.match(tabs, /function cloudParkPlusDraft/, 'leaving the draft parks source in memory');
assert.match(tabs, /function cloudSwitchToPlusDraft/, 'the parked tab restores from memory');
assert.match(tabs, /cloudPlusDraft && cloudGroupId && groupId !== cloudGroupId/, 'changing group drops the memory slot');
assert.match(tabCss, /\.group-tab:disabled/, 'disabled plus is gray');
assert.match(tabs, /askConfirm/, 'dirty saved tabs use the in-app confirm');
assert.match(tabs, /Not saved yet/, 'tab leave copy is English');
assert.doesNotMatch(tabs, /还没有保存/, 'tab leave copy is not Chinese');
assert.doesNotMatch(tabs, /window\.confirm/, 'tab switch does not use the browser confirm');
assert.match(cloud, /Delete this group\?/, 'history delete copy is English');
assert.doesNotMatch(cloud, /删除这一组/, 'history delete copy is not Chinese');
assert.match(tabs, /cloudParkDirtyDiagram/, 'confirming a switch parks dirty source');
assert.match(tabs, /cloudPlusDraftActive\) return true/, 'parking a draft does not prompt');
assert.match(cloud, /askConfirm/, 'history delete uses the in-app confirm');
assert.match(cloud, /function cloudParkDirtyDiagram/, 'dirty boards can be parked in memory');
assert.match(tabs, /isShareGuest/, 'share guests do not see group tabs');
assert.match(cloud, /joinGroupId = cloudPlusDraftActive && cloudGroupId \? cloudGroupId : null/);
assert.match(cloud, /p_group_id:\s*joinGroupId/);
assert.match(cloud, /cloudPlusDraftActive && !opts\.explicit/, 'plus draft does not autosave');
assert.match(tabs, /function cloudOpenDiagramById/, 'tab switch loads one board id');
assert.match(tabs, /cloudSetDiagramHash\(id, true\)/, 'tab switch replaces the hash without hashchange');
assert.match(tabs, /loadCloudDiagramByHash/, 'tab switch does not wait for hashchange bootstrap');
assert.match(cloud, /cloudParkPlusDraft/, '#b: load parks an active draft instead of dropping it');
assert.match(cloud, /cloudKnownGroupDiagram/, 'known group members skip a second group list fetch');
assert.match(cloud, /refreshCloudGroupMembers/, '#b: first open still refreshes group tabs');
assert.doesNotMatch(cloud, /if \(!known\) void cloudRefreshGroups/, 'opening a board does not refresh the whole mine list');
assert.match(cloud, /function cloudCachePut/, 'visited boards stay in a memory cache');
assert.match(cloud, /if \(cached\)/, 'a cached board skips the boards query');
assert.match(cloud, /cloudForgetDiagramCache/, 'sign out and group delete drop the memory cache');
assert.match(cloud, /async function deleteCloudGroup/, 'history × deletes a group');
assert.doesNotMatch(cloud, /history-group-members/, 'history lists groups, not member boards');
assert.match(boardJs, /cloudPlusDraftActive[\s\S]*saveDiagramToHash/, 'plus draft edits persist in #z:');
assert.match(boot, /!cloudPlusDraftActive/, 'hashchange does not flush an active plus draft');

{
  const start = tabs.indexOf('function sortDiagramRowsByGroupOrder');
  const end = tabs.indexOf('function cloudGroupTabsVisible');
  assert.ok(start >= 0 && end > start, 'sort helpers are a closed block');
  const helpers = new Function(tabs.slice(start, end) + '\nreturn { sortDiagramRowsByGroupOrder, cloudMembersInclude };')();
  const sorted = helpers.sortDiagramRowsByGroupOrder(
    [{ graph_id: 'b_11111111' }, { graph_id: 'b_22222222' }, { graph_id: 'b_33333333' }],
    [
      { graph_id: 'b_11111111', sort_order: 3 },
      { graph_id: 'b_22222222', sort_order: 1 },
      { graph_id: 'b_33333333', sort_order: 2 },
    ]
  );
  assert.deepStrictEqual(sorted.map((row) => row.graph_id), ['b_22222222', 'b_33333333', 'b_11111111']);
  const tied = helpers.sortDiagramRowsByGroupOrder(
    [{ graph_id: 'b_bbbbbbbb' }, { graph_id: 'b_aaaaaaaa' }],
    [{ graph_id: 'b_bbbbbbbb', sort_order: 1 }, { graph_id: 'b_aaaaaaaa', sort_order: 1 }]
  );
  assert.deepStrictEqual(tied.map((row) => row.graph_id), ['b_aaaaaaaa', 'b_bbbbbbbb'], 'ties break by graph_id');
  const members = [{ graph_id: 'b_11111111' }, { graph_id: 'b_22222222' }];
  assert.strictEqual(helpers.cloudMembersInclude('b_22222222', 'g_aaaaaaaa', members), true);
  assert.strictEqual(helpers.cloudMembersInclude('b_33333333', 'g_aaaaaaaa', members), false);
  assert.strictEqual(helpers.cloudMembersInclude('b_22222222', '', members), false);
  assert.match(tabs, /rpc\("load_group_shells", \{ p_graph_id: id \}\)/, 'tabs load shells for the open board');
  assert.doesNotMatch(tabs, /created_at/, 'tabs no longer sort by created_at');
}

assert.match(tabs, /rpc\("load_group_shells"/, 'tabs read the group from the shell rpc');
assert.doesNotMatch(tabs, /from\("graphs"\)/, 'tabs do not read every board row');
assert.doesNotMatch(tabs, /\bbmd\b/, 'tabs do not read diagram bodies');
assert.doesNotMatch(tabs, /\.title = /, 'number tabs drop the slow native title');
assert.match(tabs, /bindGroupTabTip\(btn, relabel\)/, 'number tabs show the self-drawn tip');
assert.match(tabs, /function bindGroupTabTip\(btn, label\) \{\n  bindChromeTip\(btn, label, function \(\) \{ return btn\.parentElement; \}\);/, 'tab tip is the shared chrome tip, 6px off the strip');
assert.match(tabCss, /\.chrome-tip \{[\s\S]*pointer-events: none/, 'tip never steals the pointer');
assert.match(tabCss, /\.chrome-tip \{[\s\S]*padding: 7px 10px/, 'one line stays 32px tall');
assert.match(tabCss, /\.chrome-tip \{[\s\S]*min-height: 32px/, 'short tip keeps the original 32px floor');
assert.match(tabCss, /\.chrome-tip \{[\s\S]*font: 500 13px\/18px/, 'wrapped lines use an 18px line box');
assert.match(tabCss, /html\[data-drawer-mode="diagram"\] \.chrome-tip \{[\s\S]*padding: 8px 10px/, 'diagram one line stays 36px tall');
assert.match(tabCss, /html\[data-drawer-mode="diagram"\] \.chrome-tip \{[\s\S]*min-height: 36px/, 'diagram short tip keeps the 36px floor');
assert.match(tabCss, /html\[data-drawer-mode="diagram"\] \.chrome-tip \{[\s\S]*color:\s*var\(--ink\)/, 'hover tip keeps the ink color');
assert.match(tabCss, /html\[data-drawer-mode="diagram"\] \.chrome-tip\.is-nudge \{[^}]*color:\s*var\(--accent, #db4c84\)/, 'the opening Create tip uses the theme red');
assert.doesNotMatch(tabCss.match(/html\[data-drawer-mode="diagram"\] \.chrome-tip\.is-nudge \{[^}]*\}/)[0], /background:/, 'theme red changes the text, not the paper');
assert.match(tabCss, /max-width: 240px/, 'tip keeps its width cap');
assert.match(tabCss, /transform: translate\(4px, -50%\)/, 'tip still centers on the tab');
assert.match(tabCss, /\.chrome-tip\.is-on \{[\s\S]*transform: translate\(0, -50%\)/, 'visible tip still centers on the tab');
assert.match(tabs, /chromeTipCenter\(anchor, tip\.offsetHeight, window\.innerHeight\)/, 'wrapped tip recenters from its height, then stays on screen');
assert.match(tabCss, /\.chrome-tip \{[\s\S]*white-space: normal/, 'long titles wrap instead of clipping');
assert.match(tabCss, /\.chrome-tip \{[\s\S]*overflow-wrap: break-word/, 'a long token wraps inside the tip');
assert.doesNotMatch(tabCss, /\.chrome-tip\.is-wrap/, 'no wrap class that restyles the tip');
assert.doesNotMatch(tabs, /is-wrap/, 'js does not restyle the tip when it wraps');
assert.match(tabs, /CHROME_TIP_MAX_CHARS = 100/, 'tip text caps at 100 characters');
assert.doesNotMatch(tabCss, /text-overflow:\s*ellipsis/, 'tip does not ellipsize');
assert.match(tabCss, /prefers-reduced-motion/, 'tip honors reduced motion');
{
  const start = tabs.indexOf('function clipChromeTipText');
  const end = tabs.indexOf('function chromeTip()');
  assert.ok(start >= 0 && end > start, 'clip helper is a closed block');
  const helpers = new Function(tabs.slice(tabs.indexOf('var CHROME_TIP_MAX_CHARS'), end) + '\nreturn { clipChromeTipText, chromeTipCenter };')();
  const clip = helpers.clipChromeTipText;
  assert.strictEqual(clip('短标题'), '短标题');
  assert.strictEqual(clip('x'.repeat(100)), 'x'.repeat(100));
  assert.strictEqual(clip('x'.repeat(101)), 'x'.repeat(100));
  assert.strictEqual(clip('字'.repeat(101)), '字'.repeat(100));
  assert.strictEqual(clip('🙂'.repeat(101)), '🙂'.repeat(100), 'one emoji is one character');
  assert.strictEqual(clip(null), '');
  const center = helpers.chromeTipCenter;
  assert.strictEqual(center(200, 36, 800), 200, 'a tip that fits stays on the button');
  assert.strictEqual(center(20, 36, 800), 26, 'a tip near the top shifts down');
  assert.strictEqual(center(790, 120, 800), 732, 'a tall tip near the bottom shifts up');
  assert.strictEqual(center(100, 900, 800), 400, 'a tip taller than the viewport centers in it');
}
assert.match(tabs, /"Board " \+ number \+ ": " \+ t\)/, 'aria-label is Board N: <title>');
assert.match(tabs, /title: row\.title \|\| ""/, 'tab shells use the stored title');
assert.doesNotMatch(tabs, /displayTitleFromBmd\(row\.bmd\)/, 'tab shells do not parse diagram bodies');
assert.match(tabs, /addEventListener\("mouseenter", show\)/, 'title is re-read on hover');
assert.match(tabs, /addEventListener\("focus", show\)/, 'title is re-read on focus');
assert.match(tabs, /bindGroupTabTip\(draft, function \(\) \{ return "Untitled"; \}\)/, 'unsaved draft tab hovers Untitled');
assert.match(tabs, /"Add diagram"/, 'plus keeps Add diagram');
{
  const sync = fs.readFileSync(path.join(root, 'packages/drawer-app/js/06-cloud-sync.js'), 'utf8');
  const start = sync.indexOf('function cloudOpenDiagramId');
  const end = sync.indexOf('function cloudSetDiagramHash');
  assert.ok(start > 0 && end > start, 'getDiagramTitle lives in 06-cloud-sync');
  const body = sync.slice(start, end);
  assert.match(body, /cloudDiagramTitle\(source\)/, 'reuses the existing md title parser');
  const make = (env) => new Function('cloudPlusDraftActive', 'cloudDiagramId', 'diagramSourceEl', 'cloudCachedDiagramRow', 'cloudDiagramTitle',
    body + '\nreturn getDiagramTitle;')(!!env.draft, () => env.current || '', env.el || null,
    (id) => (env.cache || {})[id] || null,
    (src) => { const m = /^\s*board\s+"([^"]*)"/.exec(String(src || '')); return m ? m[1] : ''; });
  const el = { value: 'board "Live"\n' };
  const get = make({ current: 'b_1', el, cache: { b_1: { bmd: 'board "Saved"' }, b_2: { bmd: 'board "Cached"\n', title: 'Old' } } });
  assert.strictEqual(get('b_1', 'Q'), 'Live', 'open board follows the live md');
  el.value = 'board "Renamed"\n';
  assert.strictEqual(get('b_1', 'Q'), 'Renamed', 'unsaved rename shows at once');
  assert.strictEqual(get('b_2', 'Q'), 'Cached', 'loaded board follows cached md, not its stored title');
  assert.strictEqual(get('b_3', 'Queried'), 'Queried', 'unloaded board uses the queried title');
  assert.strictEqual(get('b_3', ''), 'Untitled', 'empty → Untitled');
  el.value = 'item a\n';
  assert.strictEqual(get('b_1', 'Q'), 'Untitled', 'md without a title line → Untitled');
  const draft = make({ draft: true, current: 'b_1', el, cache: { b_1: { bmd: 'board "Saved"' } } });
  assert.strictEqual(draft('b_1', 'Q'), 'Saved', 'while on the draft, member reads its cached md');
  el.value = 'board "Draft title"\n';
  assert.strictEqual(draft(''), 'Draft title', 'open board without a cloud id reads the editor md');
  const local = make({ current: '', el: { value: 'board "Local real"\n' } });
  assert.strictEqual(local(''), 'Local real', 'local server mode (no id) keeps the real md title, not Untitled');
}
assert.doesNotMatch(tabs, /group_members/, 'tabs no longer read group_members');

{
  const plusStart = tabs.indexOf('async function cloudCommitPlusDraft');
  const plus = tabs.slice(plusStart);
  assert.match(plus, /renderCloudGroupTabs\(\);\n  if \(typeof nudgeUncreatedCreateTip === "function"\) nudgeUncreatedCreateTip\(\);/, 'plus draft shows Create after the new diagram is on screen');
  const backStart = tabs.indexOf('async function cloudSwitchToPlusDraft');
  const backEnd = tabs.indexOf('async function cloudStartPlusDraft');
  assert.doesNotMatch(tabs.slice(backStart, backEnd), /nudgeUncreatedCreateTip/, 'returning to a parked draft does not show Create again');

  const tipStart = tabs.indexOf('var chromeTipEl = null');
  const tipEnd = tabs.indexOf('function cloudKnownGroupDiagram');
  assert.ok(tipStart >= 0 && tipEnd > tipStart, 'Create nudge lives with the chrome tip');
  const tipSrc = tabs.slice(tipStart, tipEnd);

  function boot() {
    let now = 0;
    let seq = 0;
    const timers = [];
    const frames = [];
    function setTimeout(fn, ms) {
      const id = ++seq;
      timers.push({ id, fn, at: now + ms });
      return id;
    }
    function clearTimeout(id) {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    }
    function flush(ms) {
      now += ms;
      for (let guard = 0; guard < 8; guard += 1) {
        const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at || a.id - b.id);
        if (!due.length) return;
        const next = due[0];
        timers.splice(timers.indexOf(next), 1);
        next.fn();
      }
    }
    function requestAnimationFrame(fn) {
      frames.push(fn);
      return frames.length;
    }
    function flushFrame() {
      const fn = frames.shift();
      if (fn) fn();
    }
    function makeEl() {
      const classes = new Set();
      const attrs = {};
      const node = {
        hidden: false,
        isConnected: true,
        textContent: '',
        dataset: {},
        style: {},
        offsetWidth: 40,
        offsetHeight: 36,
        hover: false,
        focusVisible: false,
        classList: {
          contains: (c) => classes.has(c),
          add: (c) => classes.add(c),
          remove: (c) => classes.delete(c),
        },
        setAttribute: (k, v) => { attrs[k] = String(v); },
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        getBoundingClientRect: () => ({ left: 400, top: 16, width: 32, height: 32 }),
        matches: (sel) => (sel === ':hover' ? node.hover : sel === ':focus-visible' ? node.focusVisible : false),
      };
      return node;
    }
    const save = makeEl();
    const document = {
      body: { appendChild: (child) => child },
      activeElement: null,
      createElement: () => makeEl(),
      getElementById: (id) => (id === 'btnShellSaveCloud' ? save : null),
    };
    const window = { innerWidth: 800, innerHeight: 600 };
    const api = new Function('document', 'window', 'setTimeout', 'clearTimeout', 'requestAnimationFrame',
      tipSrc + '\nreturn { nudgeChromeTip, nudgeUncreatedCreateTip, showChromeTip, hideChromeTip, chromeTip };'
    )(document, window, setTimeout, clearTimeout, requestAnimationFrame);
    return { api, save, document, flush, flushFrame };
  }

  {
    const { api, save, flush, flushFrame } = boot();
    save.setAttribute('aria-label', 'Create');
    api.nudgeUncreatedCreateTip();
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), false, 'Create waits until the button has a box');
    flushFrame();
    assert.strictEqual(api.chromeTip().textContent, 'Create', 'the proactive tip says Create');
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), true, 'Create is showing');
    assert.strictEqual(api.chromeTip().classList.contains('is-nudge'), true, 'the opening Create tip uses the theme-red class');
    flush(2999);
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), true, 'Create stays up through 2.999s');
    flush(1);
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), false, 'Create hides at 3s');
  }
  {
    const { api, save, flush, flushFrame } = boot();
    save.hidden = true;
    save.setAttribute('aria-label', 'Create');
    api.nudgeUncreatedCreateTip();
    flushFrame();
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), false, 'a hidden button does not show Create');
    save.hidden = false;
    save.setAttribute('aria-label', 'Save');
    api.nudgeUncreatedCreateTip();
    flushFrame();
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), false, 'Save stays hover-only');
  }
  {
    const { api, save, flush } = boot();
    save.hover = true;
    api.nudgeChromeTip(save, 'Create');
    flush(3000);
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), true, 'hovering at 3s keeps the tip');
    assert.strictEqual(api.chromeTip().classList.contains('is-nudge'), false, 'a tip that stays under the pointer drops the theme red');
    save.hover = false;
    api.hideChromeTip();
    flush(60);
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), false, 'leaving the button hides it');
  }
  {
    const { api, save, flush } = boot();
    api.nudgeChromeTip(save, 'Create');
    assert.strictEqual(api.chromeTip().classList.contains('is-nudge'), true, 'Create opens in theme red');
    api.showChromeTip(save, 'Create');
    assert.strictEqual(api.chromeTip().classList.contains('is-nudge'), false, 'hover restores the original ink color');
    flush(3000);
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), true, 'moving onto the button cancels the 3s hide');
    api.hideChromeTip();
    flush(60);
    assert.strictEqual(api.chromeTip().classList.contains('is-on'), false, 'pointerdown or leave still hides at once');
  }
}
console.log('ok cloud-group-tabs');
