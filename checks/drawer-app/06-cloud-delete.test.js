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
const css = read('packages/drawer-app/css/07-cloud-chrome.css');
const del = read('packages/drawer-app/src/cloud/cloud-delete.js');
const sync = read('packages/drawer-app/src/cloud/cloud-sync.js');
const appBuild = read('scripts/build-app/drawer.mjs');

assert.match(html, /id="btnDockProps"[\s\S]*id="btnDockStyle"[\s\S]*id="btnDockSource"[\s\S]*id="btnDockExport"/, 'Source is the third dock tab');

const panel = html.slice(html.indexOf('data-dock-panel="source"'), html.indexOf('id="exportPanel"'));
assert.match(panel, /class="dock-source-foot"[\s\S]*id="btnDiagramDeleteCloud"/, 'delete sits in the Source panel footer');
assert.ok(panel.indexOf('dock-source-body') < panel.indexOf('btnDiagramDeleteCloud'), 'delete is below the editor');
assert.match(html, /id="btnDiagramDeleteCloud"[^>]*hidden/, 'delete starts hidden');
assert.strictEqual((html.match(/id="btnDiagramDeleteCloud"/g) || []).length, 1, 'cloud delete id is unique');
assert.strictEqual((html.match(/id="btnBoardDelete"/g) || []).length, 1, 'node delete id is untouched');
assert.doesNotMatch(html.slice(html.indexOf('class="diagram-dock-rail"'), html.indexOf('data-dock-panel="props"')), /btnDiagramDeleteCloud/, 'rail has no delete');
assert.match(css, /\.dock-source-foot \{[^}]*justify-content:\s*flex-end/, 'footer pins delete to the right');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-group-order.js')), 'delete module is built');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-delete.js')), 'delete module is built');
assert.match(sync, /syncBoardDeleteChrome/, 'save chrome refreshes delete visibility');

assert.match(del, /isShareGuest/, 'share guests never see delete');
assert.match(del, /cloudPlusDraftActive \|\| cloudDiagramId\(\)/, 'delete shows for a saved board or the plus draft');

{
  const start = del.indexOf('function cloudNextDiagramAfterDelete');
  const end = del.indexOf('function cloudDropPlusDraft');
  const src = del.slice(start, end);
  const next = (members, id) => new Function('cloudGroupMembers', src + '\nreturn cloudNextDiagramAfterDelete;')(members.map((b) => ({ graph_id: b })))(id);
  assert.strictEqual(next(['b_1', 'b_2', 'b_3'], 'b_2'), 'b_3', 'middle opens the next tab');
  assert.strictEqual(next(['b_1', 'b_2', 'b_3'], 'b_3'), 'b_2', 'last opens the previous tab');
  assert.strictEqual(next(['b_1', 'b_2'], 'b_1'), 'b_2', 'first opens the next tab');
  assert.strictEqual(next(['b_1'], 'b_1'), '', 'only board has no next');
}

const draft = del.slice(del.indexOf('function cloudDropPlusDraft'), del.indexOf('async function cloudDeleteSavedDiagram'));
assert.doesNotMatch(draft, /askConfirm|cloudClient/, 'dropping a draft neither asks nor hits the cloud');
assert.match(draft, /cloudClearPlusDraftSlot\(\)/, 'dropping a draft clears the memory slot');
assert.match(draft, /cloudGroupMembers\[cloudGroupMembers\.length - 1\]\.graph_id/, 'draft drop returns to the last saved board');

const saved = del.slice(del.indexOf('async function cloudDeleteSavedDiagram'), del.indexOf('async function cloudDeleteCurrentDiagram'));
assert.match(saved, /call\("askConfirm", \{[\s\S]*Delete this diagram\?/, 'saved board asks first, in English');
assert.match(saved, /deleteCloudDiagrams\(\[diagramId\]\)/, 'deletes the boards row through the board API');
assert.doesNotMatch(saved, /from\("groups"\)/, 'board delete no longer touches the groups table');
assert.doesNotMatch(saved, /group_members/, 'membership goes by cascade, not by hand');
assert.match(saved, /cloudClearDirtyLeave\(\);[\s\S]*deleteCloudDiagrams/, 'pending autosave is cancelled before delete');
assert.match(saved, /cloudForgetDiagramCache\(\[diagramId\]\)/, 'cached row is dropped');
assert.match(sync.slice(sync.indexOf('async function deleteCloudGroup')), /Delete this group\?/, 'History x still deletes the whole group');
// Source footer spacing: a hairline closes the editor, Delete has room, the char count lines up with it
const srcCss = read('packages/drawer-app/css/09-source-style.css');
assert.match(srcCss, /\.dock-source-foot:has\(\.btn-delete:not\(\[hidden\]\)\) \{\s*margin: 0 14px;\s*padding: 0 2px;\s*border-top: 1px solid var\(--paper-line\);/, 'the hairline shows only with Delete, so no empty band without it');
assert.match(srcCss, /\.dock-source-foot \.btn-delete \{ margin: 10px 0 16px; \}/, 'Delete keeps room above and below');
assert.match(srcCss, /\.source-chars \{ right: 16px; bottom: 10px; \}/, 'the char count lines up with Delete');

console.log('ok cloud-delete');
