import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const js = read('packages/drawer-app/src/chrome/shell-drawer.js');
const sync = read('packages/drawer-app/src/cloud/cloud-sync.js');
const appBuild = read('scripts/build-app/drawer.mjs');

assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/chrome/shell-drawer.js')), 'drawer script is built');
assert.doesNotMatch(appBuild, /09-shell-prototype/, 'the prototype file name is gone');
assert.match(html, /id="shellMineList"/, 'Mine is a data container, not mock rows');
assert.match(html, /id="shellShared"[^>]*hidden/, 'Shared stays hidden until it is wired');
assert.match(html, /id="shellAccountName"[\s\S]*id="btnShellSignOut"/, 'account row has name and sign out');
assert.doesNotMatch(html, /Payments retry flow<\/b><span>4 boards/, 'no mock Mine rows in the markup');
assert.match(sync, /emit\("shellPaintAccount", profile\)/, 'account row follows the session');
assert.match(js, /cloudSwitchToDiagram\(group\.faceDiagramId, group\.groupId\)/, 'a mine row passes its group id');
assert.match(js, /shellListTitle\(group\.faceDiagramId, group\.title\)/, 'Mine titles go through getDiagramTitle');
assert.match(js, /shellListTitle\(item\.diagramId, item\.title\)/, 'Shared titles go through getDiagramTitle');
assert.match(js, /if \(!diagramId \|\| typeof getDiagramTitle !== "function"\) return stored/, 'a row without an id keeps its stored title');

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
  const src = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/shell-drawer.js'), 'utf8');
  const start = src.indexOf('function shellSearchMatches');
  const end = src.indexOf('function shellSearchGroups');
  const shellSearchMatches = new Function(src.slice(start, end) + '\nreturn shellSearchMatches;')();
  const groups = [
    { groupId: 'g1', title: 'Payments retry flow', diagramCount: 2, faceDiagramId: 'b_1', members: [{ graph_id: 'b_1', title: 'Flow' }, { graph_id: 'b_2', title: 'Retry notes' }] },
    { groupId: 'g2', title: 'Onboarding', diagramCount: 1, faceDiagramId: 'b_3', members: [{ graph_id: 'b_3', title: 'Welcome' }] },
  ];
  const empty = shellSearchMatches('', groups, 'a\nb');
  assert.equal(empty.boards.length, 2, 'empty query lists recent groups');
  assert.equal(empty.lines.length, 0, 'empty query has no line hits');
  const byGroup = shellSearchMatches('RETRY', groups, '');
  assert.deepEqual(byGroup.boards.map((b) => b.groupId), ['g1'], 'matches group title case-insensitively');
  const byBoard = shellSearchMatches('notes', groups, '');
  assert.equal(byBoard.boards[0].diagramId, 'b_2', 'a board-title hit opens that board');
  assert.match(byBoard.boards[0].note, /Retry notes/, 'board-title hit names the board');
  const lines = shellSearchMatches('item', groups, 'box A\n  item one\nitem two');
  assert.deepEqual(lines.lines.map((l) => l.line), [1, 2], 'source line hits keep line numbers');
  assert.equal(shellSearchMatches('zzz', groups, 'abc').boards.length, 0, 'no match');
  assert.match(src, /section\("Mine"/, 'signed-in search lists own boards');
  assert.match(src, /section\("Public"/, 'signed-in search lists others public boards');
  assert.match(src, /cloudSearchDiagrams/, 'board search goes through the search rpc');
  assert.match(src, /cloudSearchSignedIn\(\)/, 'empty or signed-out search does not call the rpc');
  assert.match(src, /hit\.kind === "public"/, 'a Public hit opens the share link');
}

// ---- Mine paging (LB-302) ----
{
  const src = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/shell-drawer.js'), 'utf8');
  const start = src.indexOf('function shellMineWindow');
  const end = src.indexOf('// Scroll the Mine list');
  const shellMineWindow = new Function(src.slice(start, end) + '\nreturn shellMineWindow;')();
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: i }));
  const none = () => false;
  assert.equal(shellMineWindow(rows, 20, none).visible.length, 20, 'first page');
  assert.equal(shellMineWindow(rows, 20, none).hidden, 10, 'rest is held back');
  const withCurrent = shellMineWindow(rows, 20, (g) => g.id === 25);
  assert.equal(withCurrent.visible.length, 21, 'the open group is listed even past the page');
  assert.equal(withCurrent.hidden, 9, 'hidden count excludes it');
  assert.equal(shellMineWindow(rows, 40, none).hidden, 0, 'no Load more when all fit');
  assert.equal(shellMineWindow([], 20, none).visible.length, 0, 'empty list');
  assert.match(src, /function shellMinePage\(\) \{ return 20; \}/, 'page size is 20 and survives the first render running early');
}

// ---- drawer account row + spacing (LB-303) ----
{
  const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
  const src = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/shell-drawer.js'), 'utf8');
  const drawerStart = html.indexOf('id="shellDrawer"');
  const drawerHtml = html.slice(drawerStart, html.indexOf('</aside>', drawerStart));
  assert.doesNotMatch(drawerHtml, /btnShellSignIn|shell-signin/, 'no separate Sign in button in the drawer');
  assert.match(html, /id="btnShellAccount"[\s\S]{0,200}id="shellAccountAvatar"[\s\S]{0,200}id="shellAccountName"/, 'avatar + name live in one clickable account row');
  assert.doesNotMatch(src, /cloudSignIn\("google"\)/, 'the account row no longer jumps straight to Google');
  assert.match(html, /id="shellAuthMenu"[\s\S]{0,300}data-shell-oauth="google"[\s\S]{0,200}data-shell-oauth="github"/, 'the row opens a Google / GitHub choice');
  assert.match(src, /classList\.contains\("is-signin"\)[\s\S]{0,160}setAuthMenu\(/, 'signed-out row toggles the choice menu');
  const diagram = fs.readFileSync(path.join(root, 'packages/drawer-app/css/03-diagram.css'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'packages/drawer-app/css/08-workspace-shell.css'), 'utf8');
  assert.match(diagram, /\.shell-account-bar \.shell-auth-menu\s*\{/, 'canvas top offset stays on the corner menu');
  assert.doesNotMatch(diagram, /^\.shell-auth-menu\s*\{/m, 'canvas top offset does not hit the drawer menu');
  assert.match(shell, /\.shell-auth-menu\s*\{[^}]*top:\s*auto/, 'drawer menu clears top so overflow hidden cannot clip it');
  assert.match(src, /function closeAll[\s\S]{0,120}closeAuthMenu/, 'closing the drawer closes the menu');
  assert.match(src, /classList\.toggle\("is-signin", !profile\)/, 'row is only interactive while signed out');
  assert.doesNotMatch(src, /^var SHELL_ARROW/m, 'icon markup is not a var that the first render can miss');
}

// ---- properties panel: the icon picker stays closed and does not take height ----
{
  const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
  const board = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/board.js'), 'utf8');
  const boot = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/chrome-boot.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/10-icon-pop.css'), 'utf8');
  const field = html.slice(html.indexOf('id="boardIconField"'), html.indexOf('id="boardTitleField"'));
  assert.match(html, /<button type="button" id="board-icon-trigger"/, 'Icon is a trigger');
  assert.match(html, /id="board-icon-pop"[^>]*hidden/, 'the popup starts closed');
  assert.doesNotMatch(field, /board-icon-list/, 'the icon grid is not in the field');
  assert.doesNotMatch(html, /id="boardIconSec"/, 'no category select');
  assert.match(css, /\.props-icon-pop\s*\{[^}]*position:\s*fixed/, 'the popup is fixed, so it adds no panel height');
  assert.match(board, /props-icon-sec/, 'sections are labels inside the popup');
  assert.match(board, /props-icon-grid/, 'icons are a grid');
  assert.doesNotMatch(board, /props-icon-num/, 'the grid does not show numbers');
  assert.doesNotMatch(board, /boardIconSec/, 'categories are not a select');
  assert.match(boot, /openBoardIconPop/, 'the trigger opens the popup');
  assert.doesNotMatch(boot, /boardIconSec/, 'no category change handler');
}

// ---- shared rows: one action (Stop) at the right; the rest lives in the Share dialog ----
{
  const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/08-workspace-shell.css'), 'utf8');
  assert.match(css, /\.shell-row-link \.shell-row-acts \{ position: absolute; right: 8px; top: 50%; transform: translateY\(-50%\); \}/, 'Stop sits at the right edge of the row');
  assert.doesNotMatch(css, /\.shell-row-link:hover \.shell-row-main > span \{ visibility: hidden; \}/, 'the note stays visible on hover');
}

// ---- Mine: Load more is a state at the end of the list (auto-loads on reaching it), not a button ----
{
  const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/shell-drawer.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/08-workspace-shell.css'), 'utf8');
  assert.doesNotMatch(html, /id="shellMineMore"/, 'no static Load more button outside the list');
  assert.match(js, /sentinel\.className = "shell-more-item"[\s\S]*frag\.appendChild\(sentinel\)/, 'the state row is appended to the list rows');
  assert.doesNotMatch(js, /createElement\("button"\);\s*more\.type/, 'it is not a button any more');
  assert.match(js, /new IntersectionObserver[\s\S]*root: list/, 'reaching the bottom of the list triggers loading');
  assert.match(js, /"Loading more"[\s\S]*shell-dots/, 'loading shows Loading more with the dots');
  const tabsCss = fs.readFileSync(path.join(root, 'packages/drawer-app/css/09-shell-tabs.css'), 'utf8');
  assert.doesNotMatch(css, /#shellMineList \{[^}]*max-height/, 'no fixed height cap: the list fills the drawer');
  assert.match(tabsCss, /#shellMineList \{ flex: 1; min-height: 0; overflow-y: auto; \}/, 'Mine list fills the drawer and scrolls on its own');
  assert.doesNotMatch(tabsCss, /#shellMineList \{[^}]*overscroll-behavior/, 'the list does not trap the wheel');
  assert.match(css, /@keyframes shell-dot-1[\s\S]*@keyframes shell-dot-3/, 'dots cycle . .. ...');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.shell-dots i \{ animation: none/, 'reduced motion shows static dots');
}

// ---- blank start opens left drawer when early-head flagged it (LB-354) ----
{
  const src = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/shell-drawer.js'), 'utf8');
  assert.match(src, /dataset\.blankStartDrawer === "1"/, 'honors early-head blank-start drawer flag');
  assert.match(src, /delete document\.documentElement\.dataset\.blankStartDrawer/, 'clears one-shot blank-start flag');
}

// ---- blank #z waits for kind ----
{
  const src = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/shell-drawer.js'), 'utf8');
  const board = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/diagram.js'), 'utf8');
  assert.match(src, /function shellOfferBlankStartKind/, 'blank start opens the kind dialog');
  assert.match(src, /onCancel: function \(\) \{ open\(\); \}/, 'blank start Esc keeps the dialog open');
  assert.match(board, /function shouldWaitForCreateKind/, 'empty hash does not seed while waiting for kind');
  assert.match(board, /setStatus\("Choose a type"\)/, 'waiting for kind does not write Untitled');
}

// ---- New board picks kind before writing #z ----
{
  const src = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/shell-drawer.js'), 'utf8');
  const start = src.indexOf('async function shellNewBlankDiagram');
  const end = src.indexOf('async function shellCommitBlankDiagram');
  const open = src.slice(start, end);
  assert.match(open, /cloudConfirmLeaveDiagram/, 'leave-confirm stays before the kind dialog');
  assert.match(open, /openCreateKindDialog/, 'New board opens the kind dialog');
  assert.match(open, /applyCreateKindPick/, 'kind pick including Welcome uses the shared commit');
  assert.match(open, /onCancel: function \(\) \{\}/, 'cancel does not create');
  assert.doesNotMatch(open, /history\.replaceState|bootstrapDiagramFromHash|saveDiagramToHash/, 'does not write hash before pick');
  const commit = src.slice(end, src.indexOf('function shellIsPreview'));
  assert.match(commit, /loadKindTemplateSource\(kind\)/, 'kind pick fetches the built-in template');
  assert.doesNotMatch(commit, /blankHashSourceForKind/, 'kind pick does not use the JS seed');
  assert.match(commit, /saveDiagramToHash\(\{ bump: false \}\)/, 'writes #z after pick');
  assert.match(commit, /shellCloseAfterKindPick/, 'picking a type closes the left drawer');
  assert.match(commit, /syncCloudSaveChrome\(\);\n  if \(typeof nudgeUncreatedCreateTip === "function"\) nudgeUncreatedCreateTip\(\);/, 'new board shows the Create tip once the button is up');
}

