'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('packages/drawer-app/index.html');
const drawer = read('packages/drawer-app/js/09-shell-drawer.js');
const dialogJs = read('packages/drawer-app/js/09-share-dialog.js');
const shares = read('packages/drawer-app/js/06-cloud-shares.js');
const css = read('packages/drawer-app/css/09-share-dialog.css');
const build = read('scripts/drawer-app-build/build.mjs');

// ---- markup ----
const sheet = html.slice(html.indexOf('id="shareDialog"'), html.indexOf('id="boardConfirmDialog"'));
assert.match(sheet, /role="dialog" aria-modal="true" aria-labelledby="shareDialogTitle"/, 'a real modal dialog');
assert.match(sheet, /id="shareLinkInput"[^>]*readonly/, 'the link is a read-only field');
assert.match(sheet, /id="shareCopy"/, 'Copy sits next to the link');
assert.match(sheet, /role="radiogroup"[\s\S]*data-share-role="view"[\s\S]*data-share-role="edit"/, 'access is a View / Edit choice');
assert.match(sheet, /role="switch"[^>]*id="sharePublicToggle"|id="sharePublicToggle"[^>]*role="switch"/, 'Public is a switch on top of the link, not a second access radio');
assert.match(sheet, /id="sharePublicLabel">Listed in search/, 'Public copy is Listed in search');
assert.match(sheet, /id="shareNewLink"[\s\S]*The old link stops working/, 'a new link says what happens to the old one');
assert.match(sheet, /id="shareOpenBoard"[^>]*hidden/, 'Open board is for rows that are not the open board');
assert.doesNotMatch(sheet, /Stop/, 'Stopping a share stays on the row, not in the dialog');

// ---- build, wiring ----
assert.match(build, /09-shell-drawer\.js[\s\S]*09-share-dialog\.js/, 'dialog script is built after the drawer script');
assert.match(drawer, /shareDialogOpenCurrent\(false\)/, 'Share this board opens the dialog');
assert.doesNotMatch(drawer + shares, /cloudShareOpenBoard/, 'no more silent create-and-copy');
const row = drawer.slice(drawer.indexOf('var acts = document.createElement("div")'), drawer.indexOf('if (!rows.length)'));
assert.ok(!/shellShareAction\("(Copy|View|Edit|New link)"/.test(row) && !/"Edit" : "View"/.test(row), 'a Shared row has no Copy / View / New link buttons');
assert.match(row, /shellShareAction\("Stop"/, 'a Shared row keeps Stop');
assert.match(row, /li\.addEventListener\("click", openShare\)/, 'the row opens the Share dialog');
assert.match(css, /\.share-seg button\[aria-checked="true"\]/, 'the chosen access is visibly selected');
assert.match(css, /\.share-switch\[aria-checked="true"\]/, 'Public on is visibly selected');
assert.match(css, /\.share-switch::after/, 'Public on/off is a sliding thumb, not a full-width pill');
assert.match(sheet, /class="share-switch-name"[^>]*>Public/, 'Public stays a name next to the switch');

// ---- behaviour, on a small fake DOM ----
function makeEl(id) {
  const attrs = {};
  const el = {
    id, hidden: false, disabled: false, textContent: '', value: '', listeners: {},
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return attrs[k] === undefined ? null : attrs[k]; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    focus() {}, click() { (this.listeners.click || []).forEach((f) => f({ target: this })); },
  };
  return el;
}
function load(opts) {
  const ids = ['shareDialog', 'shareDialogBackdrop', 'shareDialogBoard', 'shareDialogOff', 'shareDialogOn', 'shareOpenBoard',
    'shareLinkInput', 'shareRoleHint', 'shareDone', 'shareCreate', 'shareCopy', 'shareNewLink', 'sharePublicToggle', 'sharePublicHint'];
  const els = {};
  ids.forEach((id) => { els[id] = makeEl(id); });
  els.shareDialog.hidden = true;
  const roleBtns = ['view', 'edit'].map((r) => { const b = makeEl('role-' + r); b.setAttribute('data-share-role', r); b.setAttribute('aria-checked', r === 'view' ? 'true' : 'false'); return b; });
  const calls = [];
  const ctx = {
    document: {
      getElementById: (id) => els[id] || null,
      querySelectorAll: (sel) => (sel === '[data-share-role]' ? roleBtns : []),
      addEventListener() {},
    },
    location: { origin: 'https://luluboard.app', search: opts.search || '' },
    window: {}, setTimeout() {}, console,
    shellIsPreview: () => !!opts.preview,
    shellShares: opts.shares || [],
    shellSampleShares: () => [{ boardId: 'x2', shareId: 's_' + 'b'.repeat(32), title: 'Android MVI', role: 'edit', isCurrent: false }, { boardId: 'x1', shareId: 's_' + 'a'.repeat(32), title: 'LLM architecture', role: 'view', isCurrent: true }],
    cloudBoardId: () => 'b_open',
    cloudOpenBoardId: () => 'b_open',
    getBoardTitle: (id) => (id === 'b_open' ? 'Open board title' : 'Untitled'),
    cloudShareLinkFor: (id) => 'https://luluboard.app/#s:' + id,
    cloudShareMutate: async (boardId, rpc, args) => { calls.push({ boardId, rpc, args }); if (opts.after) opts.after(ctx, rpc, args); return {}; },
    cloudShareCopyLink: async (id) => { calls.push({ copy: id }); },
  };
  vm.createContext(ctx);
  vm.runInContext(dialogJs + '\nthis.api = { shareDialogOpen, shareDialogOpenCurrent, shareDialogClose, shareDialogCreateLink, shareDialogSetRole, shareDialogSetPublic, shareDialogRenewLink, shareDialogCopyLink };', ctx);
  return { ctx, els, roleBtns, calls, api: ctx.api };
}
const plain = (x) => JSON.parse(JSON.stringify(x));
const tick = () => new Promise((r) => setImmediate(r));

(async () => {
  // preview: the dialog is interactive on sample data
  {
    const t = load({ preview: true });
    t.api.shareDialogOpenCurrent(false);
    assert.strictEqual(t.els.shareDialog.hidden, false, 'opens');
    assert.strictEqual(t.els.shareDialogBoard.textContent, 'LLM architecture');
    assert.strictEqual(t.els.shareDialogOn.hidden, false, 'a shared board shows its link');
    assert.strictEqual(t.els.shareOpenBoard.hidden, true, 'no Open board for the open board');
    assert.match(t.els.shareLinkInput.value, /#s:s_a{32}$/);
    t.api.shareDialogSetRole('edit'); await tick();
    assert.strictEqual(t.roleBtns[1].getAttribute('aria-checked'), 'true', 'Edit becomes the chosen access');
    assert.match(t.els.shareRoleHint.textContent, /can edit/);
    const before = t.els.shareLinkInput.value;
    t.api.shareDialogRenewLink(); await tick();
    assert.notStrictEqual(t.els.shareLinkInput.value, before, 'a new link replaces the old one');
    assert.deepStrictEqual(plain(t.calls), [], 'preview never calls the cloud');
    t.api.shareDialogClose();
    assert.strictEqual(t.els.shareDialog.hidden, true, 'closes');
  }
  // preview, not shared yet: Create link first
  {
    const t = load({ preview: true });
    t.api.shareDialogOpenCurrent(true);
    assert.strictEqual(t.els.shareDialogOff.hidden, false, 'not shared: offer Create link');
    assert.strictEqual(t.els.shareDialogOn.hidden, true);
    t.api.shareDialogCreateLink(); await tick();
    assert.strictEqual(t.els.shareDialogOn.hidden, false, 'after Create link the link shows');
    assert.strictEqual(t.roleBtns[0].getAttribute('aria-checked'), 'true', 'a new link starts as view');
    assert.strictEqual(t.els.sharePublicToggle.getAttribute('aria-checked'), 'false', 'a new link starts with Public off');
  }
  // a row that is not the open board offers Open board
  {
    const t = load({ preview: true });
    t.api.shareDialogOpen({ boardId: 'x2', shareId: 's_' + 'b'.repeat(32), title: 'Android MVI', role: 'edit', isCurrent: false });
    assert.strictEqual(t.els.shareOpenBoard.hidden, false);
    assert.strictEqual(t.roleBtns[1].getAttribute('aria-checked'), 'true');
  }
  // live: each choice is one cloud call on that board; the refreshed list decides what is shown
  {
    const share = { boardId: 'b_1', shareId: 's_' + 'c'.repeat(32), title: 'Live board', role: 'view', isCurrent: false };
    const t = load({ preview: false, shares: [share], after(ctx, rpc) {
      if (rpc === 'set_share_role') ctx.shellShares = [Object.assign({}, share, { role: 'edit' })];
      if (rpc === 'rotate_share') ctx.shellShares = [Object.assign({}, share, { shareId: 's_' + 'd'.repeat(32) })];
      if (rpc === 'unshare') ctx.shellShares = [];
    } });
    t.api.shareDialogOpen(share);
    t.api.shareDialogSetRole('edit'); await tick(); await tick();
    assert.deepStrictEqual(plain(t.calls[0]), { boardId: 'b_1', rpc: 'set_share_role', args: { p_role: 'edit' } });
    assert.strictEqual(t.roleBtns[1].getAttribute('aria-checked'), 'true');
    t.api.shareDialogSetRole('edit'); await tick();
    assert.strictEqual(t.calls.length, 1, 'choosing the same access again does nothing');
    t.api.shareDialogRenewLink(); await tick(); await tick();
    assert.strictEqual(t.calls[1].rpc, 'rotate_share');
    assert.match(t.els.shareLinkInput.value, /#s:s_d{32}$/, 'the link field shows the new link');
    await t.api.shareDialogCopyLink();
    assert.deepStrictEqual(plain(t.calls[2]), { copy: 's_' + 'd'.repeat(32) }, 'Copy copies the current link');
  }
  // live, no link yet: Create link makes one for the open board
  {
    const t = load({ preview: false, shares: [], after(ctx, rpc) {
      if (rpc === 'open_share') ctx.shellShares = [{ boardId: 'b_open', shareId: 's_' + 'e'.repeat(32), title: 'Open board title', role: 'view', isCurrent: true }];
    } });
    t.api.shareDialogOpenCurrent(false);
    assert.strictEqual(t.els.shareDialogOff.hidden, false);
    assert.strictEqual(t.els.shareDialogBoard.textContent, 'Open board title');
    t.api.shareDialogCreateLink(); await tick(); await tick();
    assert.strictEqual(t.calls[0].rpc, 'open_share');
    assert.strictEqual(t.els.shareDialogOn.hidden, false, 'the link shows once it exists');
    assert.strictEqual(t.els.sharePublicToggle.getAttribute('aria-checked'), 'false', 'Create link leaves Public off');
  }
  // Public is a separate switch; Edit is disabled while Public is on
  {
    const share = { boardId: 'b_1', shareId: 's_' + 'c'.repeat(32), title: 'Live board', role: 'view', isPublic: false, isCurrent: false };
    const t = load({ preview: false, shares: [share], after(ctx, rpc, args) {
      if (rpc === 'set_share_role' && args && args.p_principal === 'public' && args.p_role === 'view') {
        ctx.shellShares = [Object.assign({}, share, { isPublic: true })];
      }
      if (rpc === 'set_share_role' && args && args.p_principal === 'public' && args.p_role === 'off') {
        ctx.shellShares = [Object.assign({}, share, { isPublic: false })];
      }
    } });
    t.api.shareDialogOpen(share);
    t.api.shareDialogSetPublic(true); await tick(); await tick();
    assert.deepStrictEqual(plain(t.calls[0]), { boardId: 'b_1', rpc: 'set_share_role', args: { p_role: 'view', p_principal: 'public' } });
    assert.strictEqual(t.els.sharePublicToggle.getAttribute('aria-checked'), 'true');
    assert.strictEqual(t.roleBtns[1].disabled, true, 'Edit is disabled while Public is on');
    t.api.shareDialogSetRole('edit'); await tick();
    assert.strictEqual(t.calls.length, 1, 'Edit while Public does not call the cloud');
    t.api.shareDialogSetPublic(false); await tick(); await tick();
    assert.deepStrictEqual(plain(t.calls[1].args), { p_role: 'off', p_principal: 'public' });
  }
  // Edit on: Public switch is disabled
  {
    const share = { boardId: 'b_2', shareId: 's_' + 'f'.repeat(32), title: 'Edit board', role: 'edit', isPublic: false, isCurrent: false };
    const t = load({ preview: false, shares: [share] });
    t.api.shareDialogOpen(share);
    assert.strictEqual(t.els.sharePublicToggle.disabled, true);
    t.api.shareDialogSetPublic(true); await tick();
    assert.deepStrictEqual(plain(t.calls), [], 'Public while Edit does not call the cloud');
  }
  console.log('ok 09-share-dialog');
})().catch((e) => { console.error(e); process.exit(1); });
