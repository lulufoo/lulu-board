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
const build = read('scripts/build-app/drawer.mjs');
const exportPng = read('packages/drawer-app/src/export/export-png.js');
const boot = read('packages/drawer-app/src/chrome/chrome-boot.js');
const shell = read('packages/drawer-app/src/state/shell-state.js');

assert.match(html, /id="btnCanvasDlPng"(?![^>]*\bhidden\b)/, 'Export panel exposes PNG');
assert.match(html, />Export File</, 'Export panel exposes File');
assert.match(html, />Export PNG</, 'Export PNG label stays');
assert.doesNotMatch(html, /Copy Path/, 'Copy Path label is gone');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/export/export-png.js')), 'build includes PNG export module');
assert.match(build, /snapdom\.mjs/, 'build ships SnapDOM');
assert.match(exportPng, /import\s*\{\s*snapdom\s*\}\s*from\s*['"]\.\/snapdom\.mjs['"]/, 'uses SnapDOM');
assert.match(exportPng, /function paintExportGrid/, 'rebuilds the canvas grid offscreen');
assert.match(exportPng, /function findExportInkBounds/, 'measures visible content before cropping');
assert.match(exportPng, /cropExportCanvas\(captured, surfaceSize\)/, 'crops from visible content bounds');
assert.match(exportPng, /function saveExportBlob/, 'File and PNG share one save helper');
assert.match(exportPng, /showSaveFilePicker/, 'prefers a save picker');
assert.match(exportPng, /link\.download = name/, 'falls back to a download');
assert.match(exportPng, /function exportDiagramFile/, 'exports the board file');
assert.doesNotMatch(exportPng, /fetch\(['"]\.\/export\.png['"]/, 'does not write PNG through loopback');
assert.match(exportPng, /document\.body\.appendChild/, 'captures an offscreen clone');
assert.match(boot, /btnCanvasDlPng.*exportPng/, 'Export PNG button triggers PNG export');
assert.match(boot, /btnCanvasCopySrc.*exportDiagramFile/, 'Export File button triggers file export');
assert.doesNotMatch(boot, /copyActiveSourcePath/, 'Copy Path handler is gone');
assert.match(shell, /Export File below/, 'export hint names Export File');

assert.doesNotMatch(exportPng, /liveBoardTitle/, 'export no longer reads the switch-time title copy');
assert.match(exportPng, /call\("getDiagramTitle", call\("cloudOpenDiagramId"\)\)/, 'export title comes from getDiagramTitle');
{
  // switch to a board, then rename it in the editor: export uses the new title
  const renderIo = read('packages/drawer-app/src/export/render-io.js');
  const sync = read('packages/drawer-app/src/cloud/cloud-sync.js');
  const stemSrc = exportPng.slice(exportPng.indexOf('function exportDiagramStem'));
  const stemBody = stemSrc.slice(0, stemSrc.indexOf('\n}\n') + 3);
  const titleSrc = sync.slice(sync.indexOf('function cloudOpenDiagramId'), sync.indexOf('function cloudSetDiagramHash'));
  const stemOf = renderIo.slice(renderIo.indexOf('function exportStem'), renderIo.indexOf('var copyTipTimer'));
  const env = { hash: 'b_1', el: { value: 'board "Old name"\n' }, cache: { b_1: { bmd: 'board "Old name"\n' } } };
  const api = new Function('env', `
    var cloudPlusDraftActive = false, liveDiagramId = 'b_1', liveDiagramPath = '';
    function cloudDiagramId() { return env.hash; }
    var diagramSourceEl = env.el;
    function cloudCachedDiagramRow(id) { return env.cache[id] || null; }
    function cloudDiagramTitle(src) { var m = /^\\s*board\\s+"([^"]*)"/.exec(String(src || '')); return m ? m[1] : ''; }
    function liveRecordId() { return liveDiagramId || ''; }
    function call(name, a) {
      if (name === 'cloudOpenDiagramId') return cloudOpenDiagramId();
      if (name === 'getDiagramTitle') return getDiagramTitle(a);
    }
    ${stemOf}\n${titleSrc}\n${stemBody}
    return { exportDiagramStem: exportDiagramStem };`)(env);
  assert.strictEqual(api.exportDiagramStem(), 'Old-name', 'export uses the open board title');
  env.el.value = 'board "New name"\n';
  assert.strictEqual(api.exportDiagramStem(), 'New-name', 'after renaming in the editor, export uses the new title');
}
const shellJs = read('packages/drawer-app/src/state/shell-state.js');
assert.doesNotMatch(shellJs, /liveBoardTitle/, 'liveBoardTitle copy is gone');

// sketch export: the live iframe document is captured in place, never cloned
assert.match(exportPng, /import Sketch from '\.\.\/kinds\/sketch\.js'/, 'export reuses the sketch frame bounds');
{
  const exportBody = exportPng.slice(exportPng.indexOf('export async function exportPng'));
  assert.match(exportBody, /getExportSketchFrame\(\)/, 'export looks for a sketch frame before the board canvas');
  assert.match(exportBody, /showCopyTip\('Nothing to export'\)/, 'an empty export is shown to the user, not only written to the status line');
  const sketchSrc = exportPng.slice(exportPng.indexOf('async function captureSketchCanvas'), exportPng.indexOf('export async function exportPng'));
  assert.doesNotMatch(sketchSrc, /cloneNode|mountExportClone/, 'sketch is captured in place, not cloned');
  assert.match(sketchSrc, /snapdom\.toCanvas\(doc\.documentElement,/, 'sketch captures the frame document');
}
{
  const surfaceSrc = exportPng.slice(exportPng.indexOf('function assertExportSurface'), exportPng.indexOf('/* A sketch lives'));
  const sketchSrc = exportPng.slice(exportPng.indexOf('async function captureSketchCanvas'), exportPng.indexOf('export async function exportPng'));
  const calls = [];
  const draws = [];
  const docEl = { tag: 'html' };
  const env = {
    Sketch: { sketchWorldBounds: (frame) => frame.bounds },
    snapdom: { toCanvas: async (el, opts) => { calls.push({ el, opts }); return { width: 1920, height: 1080 }; } },
    document: {
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: (...args) => draws.push(args) }) }),
    },
  };
  const api = new Function('env', `
    const { Sketch, snapdom, document } = env;
    const PNG_EXPORT_SCALE = 2, PNG_EXPORT_CAPTURE_BLEED = 64, PNG_EXPORT_MAX_EDGE = 16384, PNG_EXPORT_MAX_PIXELS = 64000000;
    ${surfaceSrc}\n${sketchSrc}
    return { captureSketchCanvas };`)(env);
  const frame = (bounds, contentDocument) => ({ bounds, contentDocument });
  const ready = { documentElement: docEl, fonts: { ready: Promise.resolve() } };

  const out = await api.captureSketchCanvas(frame({ width: 960, height: 540 }, ready));
  assert.strictEqual(calls.length, 1, 'sketch is captured once');
  assert.strictEqual(calls[0].el, docEl, 'snapdom receives the live frame document element');
  assert.strictEqual(calls[0].opts.scale, 2, 'sketch is captured at 2x like a board');
  assert.strictEqual(calls[0].opts.backgroundColor, null, 'sketch capture stays transparent for the grid');
  assert.strictEqual(out.captured.width, 1920 + 64 * 2 * 2, 'bleed is added on both sides at pixel ratio');
  assert.strictEqual(out.captured.height, 1080 + 64 * 2 * 2, 'bleed is added on both sides at pixel ratio');
  assert.deepStrictEqual(out.surfaceSize, { width: 960 + 128, height: 540 + 128 }, 'surface size matches the padded capture');
  assert.deepStrictEqual(draws[0].slice(1), [128, 128], 'sketch is drawn inside the bleed');

  await assert.rejects(() => api.captureSketchCanvas(frame(null, ready)), /no exportable size/, 'an unmeasured sketch fails visibly');
  await assert.rejects(() => api.captureSketchCanvas(frame({ width: 960, height: 540 }, null)), /not ready to export/, 'a frame without a document fails visibly');
  await assert.rejects(() => api.captureSketchCanvas(frame({ width: 9000, height: 9000 }, ready)), /too large/, 'oversized sketch is refused before capture');
  assert.strictEqual(calls.length, 1, 'failed exports never reach the capture');
}

// Export File: the suffix follows the source kind (.bmd Boxes, .skt Sketch, .mmd Mermaid)
{
  const exportBody = exportPng.slice(exportPng.indexOf('export async function exportDiagramFile'), exportPng.indexOf('async function writePngExport'));
  assert.doesNotMatch(exportBody, /exportDiagramStem\(\) \+ "\.bmd"/, 'file export no longer hard-codes .bmd');
  assert.match(exportBody, /exportDiagramStem\(\) \+ suffix/, 'file name takes the suffix of the source kind');
  assert.match(exportBody, /EXPORT_FILE_LABELS\[suffix\]/, 'save picker names the file type from the same suffix');
  assert.match(exportBody, /showCopyTip\("Nothing to export"\)/, 'an empty file export is shown to the user');

  const Style = require('../../packages/drawer-app/src/core/style-line.js').default;
  const { kindTemplateFileName } = require('../../packages/drawer-app/src/core/kind-template.js');
  const helperSrc = exportPng.slice(exportPng.indexOf('const EXPORT_FILE_FALLBACK_SUFFIX'), exportPng.indexOf('export async function exportDiagramFile'));
  const { exportFileSuffix, EXPORT_FILE_LABELS } = new Function('kindTemplateFileName', `${helperSrc}\nreturn { exportFileSuffix, EXPORT_FILE_LABELS };`)(kindTemplateFileName);
  const suffixOf = (source) => exportFileSuffix(Style.bodyKind(source));
  const tpl = (name) => read('packages/drawer-app/templates/' + name);

  assert.strictEqual(suffixOf(tpl('boxes.bmd')), '.bmd', 'Boxes exports .bmd');
  assert.strictEqual(suffixOf(tpl('sketch.skt')), '.skt', 'Sketch exports .skt');
  assert.strictEqual(suffixOf(tpl('welcome.bmd')), '.skt', 'the welcome file is a Sketch, so it exports .skt despite its template name');
  for (const name of fs.readdirSync(path.join(root, 'packages/drawer-app/templates')).filter((n) => n.endsWith('.mmd'))) {
    assert.strictEqual(suffixOf(tpl(name)), '.mmd', name + ' exports .mmd');
  }
  assert.strictEqual(suffixOf('pie\n  "a" : 1\n'), '.mmd', 'a Mermaid type the app cannot draw is still Mermaid source');
  assert.strictEqual(suffixOf('just some words\n'), '.bmd', 'an unknown source keeps .bmd');
  assert.strictEqual(exportFileSuffix('empty'), '.bmd', 'an empty source keeps .bmd');
  assert.strictEqual(exportFileSuffix(''), '.bmd', 'a missing kind keeps .bmd');
  for (const suffix of ['.bmd', '.skt', '.mmd']) {
    assert.ok(EXPORT_FILE_LABELS[suffix], suffix + ' has a picker label');
  }
}

console.log('ok export-png');
