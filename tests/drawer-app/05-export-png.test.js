'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const build = read('scripts/drawer-app-build/build.mjs');
const exportPng = read('packages/drawer-app/js/05-export-png.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');
const shell = read('packages/drawer-app/js/01-shell-state.js');

assert.match(html, /id="btnCanvasDlPng"(?![^>]*\bhidden\b)/, 'Export panel exposes PNG');
assert.match(html, />Export File</, 'Export panel exposes File');
assert.match(html, />Export PNG</, 'Export PNG label stays');
assert.doesNotMatch(html, /Copy Path/, 'Copy Path label is gone');
assert.match(build, /05-export-png\.js/, 'build includes PNG export module');
assert.match(build, /snapdom\.mjs/, 'build ships SnapDOM');
assert.match(exportPng, /import\s*\{\s*snapdom\s*\}\s*from\s*['"]\.\/snapdom\.mjs['"]/, 'uses SnapDOM');
assert.match(exportPng, /function paintExportGrid/, 'rebuilds the canvas grid offscreen');
assert.match(exportPng, /function findExportInkBounds/, 'measures visible content before cropping');
assert.match(exportPng, /cropExportCanvas\(captured, surfaceSize\)/, 'crops from visible content bounds');
assert.match(exportPng, /function saveExportBlob/, 'File and PNG share one save helper');
assert.match(exportPng, /showSaveFilePicker/, 'prefers a save picker');
assert.match(exportPng, /link\.download = name/, 'falls back to a download');
assert.match(exportPng, /function exportBoardFile/, 'exports the board file');
assert.doesNotMatch(exportPng, /fetch\(['"]\.\/export\.png['"]/, 'does not write PNG through loopback');
assert.match(exportPng, /document\.body\.appendChild/, 'captures an offscreen clone');
assert.match(boot, /btnCanvasDlPng.*exportPng/, 'Export PNG button triggers PNG export');
assert.match(boot, /btnCanvasCopySrc.*exportBoardFile/, 'Export File button triggers file export');
assert.doesNotMatch(boot, /copyActiveSourcePath/, 'Copy Path handler is gone');
assert.match(shell, /Export File below/, 'export hint names Export File');

assert.doesNotMatch(exportPng, /liveBoardTitle/, 'export no longer reads the switch-time title copy');
assert.match(exportPng, /getBoardTitle\(cloudOpenBoardId\(\)\)/, 'export title comes from getBoardTitle');
{
  // switch to a board, then rename it in the editor: export uses the new title
  const renderIo = read('packages/drawer-app/js/05-render-io.js');
  const sync = read('packages/drawer-app/js/06-cloud-sync.js');
  const stemSrc = exportPng.slice(exportPng.indexOf('function exportBoardStem'));
  const stemBody = stemSrc.slice(0, stemSrc.indexOf('\n}\n') + 3);
  const titleSrc = sync.slice(sync.indexOf('function cloudOpenBoardId'), sync.indexOf('function cloudSetBoardHash'));
  const stemOf = renderIo.slice(renderIo.indexOf('function exportStem'), renderIo.indexOf('var copyTipTimer'));
  const env = { hash: 'b_1', el: { value: 'board "Old name"\n' }, cache: { b_1: { bmd: 'board "Old name"\n' } } };
  const api = new Function('env', `
    var cloudPlusDraftActive = false, liveBoardId = 'b_1';
    function cloudBoardId() { return env.hash; }
    var boardSourceEl = env.el;
    function cloudCachedBoardRow(id) { return env.cache[id] || null; }
    function cloudBoardTitle(src) { var m = /^\\s*board\\s+"([^"]*)"/.exec(String(src || '')); return m ? m[1] : ''; }
    ${stemOf}\n${titleSrc}\n${stemBody}
    return { exportBoardStem: exportBoardStem };`)(env);
  assert.strictEqual(api.exportBoardStem(), 'Old-name', 'export uses the open board title');
  env.el.value = 'board "New name"\n';
  assert.strictEqual(api.exportBoardStem(), 'New-name', 'after renaming in the editor, export uses the new title');
}
const shellJs = read('packages/drawer-app/js/01-shell-state.js');
assert.doesNotMatch(shellJs, /liveBoardTitle/, 'liveBoardTitle copy is gone');

console.log('ok export-png');
