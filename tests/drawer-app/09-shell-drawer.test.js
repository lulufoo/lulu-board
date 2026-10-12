'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const js = read('packages/drawer-app/js/09-shell-drawer.js');
const sync = read('packages/drawer-app/js/06-cloud-sync.js');
const appBuild = read('scripts/drawer-app-build/build.mjs');

assert.match(appBuild, /09-shell-drawer\.js/, 'drawer script is built');
assert.doesNotMatch(appBuild, /09-shell-prototype/, 'the prototype file name is gone');
assert.match(html, /id="shellMineList"/, 'Mine is a data container, not mock rows');
assert.match(html, /id="shellShared"[^>]*hidden/, 'Shared stays hidden until it is wired');
assert.match(html, /id="shellAccountName"[\s\S]*id="btnShellSignOut"/, 'account row has name and sign out');
assert.doesNotMatch(html, /Payments retry flow<\/b><span>4 boards/, 'no mock Mine rows in the markup');
assert.match(sync, /shellPaintAccount\(profile\)/, 'account row follows the session');
assert.match(sync, /shellRenderMine\(groups\)/, 'Mine follows the cloud group list');

const grab = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const { shellWhen } = new Function(grab(js, 'function shellWhen', '// Local preview has no cloud') + '\nreturn { shellWhen };')();
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
assert.strictEqual(shellWhen(day(0)), 'today');
assert.strictEqual(shellWhen(day(1)), 'yesterday');
assert.match(shellWhen(day(3)), /^[A-Z][a-z]+day$/, 'within a week: weekday name');
assert.match(shellWhen(day(30)), /^[A-Z][a-z]{2} \d{1,2}$/, 'older: short date');
assert.strictEqual(shellWhen(''), '');
assert.strictEqual(shellWhen('nope'), '');
console.log('ok 09-shell-drawer');

// ---- search (LB-294) ----
{
  const src = fs.readFileSync(path.join(root, 'packages/drawer-app/js/09-shell-drawer.js'), 'utf8');
  const start = src.indexOf('function shellSearchMatches');
  const end = src.indexOf('function shellSearchGroups');
  const shellSearchMatches = new Function(src.slice(start, end) + '\nreturn shellSearchMatches;')();
  const groups = [
    { groupId: 'g1', title: 'Payments retry flow', boardCount: 2, faceBoardId: 'b_1', members: [{ board_id: 'b_1', title: 'Flow' }, { board_id: 'b_2', title: 'Retry notes' }] },
    { groupId: 'g2', title: 'Onboarding', boardCount: 1, faceBoardId: 'b_3', members: [{ board_id: 'b_3', title: 'Welcome' }] },
  ];
  const empty = shellSearchMatches('', groups, 'a\nb');
  assert.equal(empty.boards.length, 2, 'empty query lists recent groups');
  assert.equal(empty.lines.length, 0, 'empty query has no line hits');
  const byGroup = shellSearchMatches('RETRY', groups, '');
  assert.deepEqual(byGroup.boards.map((b) => b.groupId), ['g1'], 'matches group title case-insensitively');
  const byBoard = shellSearchMatches('notes', groups, '');
  assert.equal(byBoard.boards[0].boardId, 'b_2', 'a board-title hit opens that board');
  assert.match(byBoard.boards[0].note, /Retry notes/, 'board-title hit names the board');
  const lines = shellSearchMatches('item', groups, 'box A\n  item one\nitem two');
  assert.deepEqual(lines.lines.map((l) => l.line), [1, 2], 'source line hits keep line numbers');
  assert.equal(shellSearchMatches('zzz', groups, 'abc').boards.length, 0, 'no match');
}

// ---- Mine paging (LB-302) ----
{
  const src = fs.readFileSync(path.join(root, 'packages/drawer-app/js/09-shell-drawer.js'), 'utf8');
  const start = src.indexOf('function shellMineWindow');
  const end = src.indexOf('// Scroll the Mine list');
  const shellMineWindow = new Function(src.slice(start, end) + '\nreturn shellMineWindow;')();
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: i }));
  const none = () => false;
  assert.equal(shellMineWindow(rows, 8, none).visible.length, 8, 'first page');
  assert.equal(shellMineWindow(rows, 8, none).hidden, 22, 'rest is held back');
  const withCurrent = shellMineWindow(rows, 8, (g) => g.id === 20);
  assert.equal(withCurrent.visible.length, 9, 'the open group is listed even past the page');
  assert.equal(withCurrent.hidden, 21, 'hidden count excludes it');
  assert.equal(shellMineWindow(rows, 40, none).hidden, 0, 'no Load more when all fit');
  assert.equal(shellMineWindow([], 8, none).visible.length, 0, 'empty list');
  assert.match(src, /function shellMinePage\(\)/, 'page size survives the first render running early');
}

// ---- drawer account row + spacing (LB-303) ----
{
  const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
  const src = fs.readFileSync(path.join(root, 'packages/drawer-app/js/09-shell-drawer.js'), 'utf8');
  assert.doesNotMatch(html, /btnShellSignIn|shell-signin/, 'no separate Sign in button in the drawer');
  assert.match(html, /id="btnShellAccount"[\s\S]{0,200}id="shellAccountAvatar"[\s\S]{0,200}id="shellAccountName"/, 'avatar + name live in one clickable account row');
  assert.match(src, /classList\.contains\("is-signin"\)[\s\S]{0,160}cloudSignIn\("google"\)/, 'signed-out row starts the sign-in flow directly');
  assert.match(src, /classList\.toggle\("is-signin", !profile\)/, 'row is only interactive while signed out');
  assert.doesNotMatch(src, /^var SHELL_ARROW/m, 'icon markup is not a var that the first render can miss');
}

// ---- properties panel: icon categories are a dropdown, not a grid of blocks ----
{
  const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
  const board = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-board.js'), 'utf8');
  const boot = fs.readFileSync(path.join(root, 'packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
  assert.match(html, /<select id="boardIconSec"/, 'Icon category is a select');
  assert.doesNotMatch(html, /id="boardIconSec" role="group"/, 'no block group for categories');
  assert.match(board, /<option value=/, 'categories are rendered as options');
  assert.match(boot, /boardIconSec\.addEventListener\("change"/, 'picking a category switches the icon list');
}

// ---- shared rows: a real gap between the title and the hover actions ----
{
  const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/08-workspace-shell.css'), 'utf8');
  assert.match(css, /\.shell-row-link \.shell-row-main \{ gap: 6px; \}/, 'title keeps 6px from the second line');
  assert.match(css, /\.shell-row-link \.shell-row-main > span \{ height: 20px; line-height: 20px; \}/, 'second line is a fixed 20px slot, same height as the buttons');
  assert.match(css, /\.shell-row-link \.shell-row-acts \{ bottom: 8px; \}/, 'actions sit in that slot');
}
