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
