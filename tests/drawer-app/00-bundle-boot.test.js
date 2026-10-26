import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
// Loads the whole built drawer script (every file in build order, as one script) against a recording DOM stub,
// for a cloud-board URL (#b:...). A top-level throw anywhere stops the rest of the script, and the Dock icons
// are wired near the end of it, so that is what the test watches for.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const build = fs.readFileSync(path.join(root, 'scripts/build-app/drawer.mjs'), 'utf8');
assert.match(build, /src\/main\.js/, 'drawer-app is built from src/main.js');
assert.doesNotMatch(build, /const domain = \[/, 'handwritten leftover concat list is gone');
const Token = require('../../packages/board-core/style-token.js');
const srcState = [
  'src/core/hooks.js',
  'src/core/sentry-count.js',
  'src/state/shell-state.js',
  'src/state/canvas-interaction.js',
  'src/kinds/sketch.js',
  'src/kinds/design.js',
  'src/kinds/mindmap.js',
  'src/kinds/mindmap-select.js',
  'src/kinds/mermaid-halo.js',
  'src/kinds/flowchart-shapes.js',
  'src/kinds/flowchart.js',
  'src/kinds/diagram.js',
  'src/kinds/board-logic.js',
  'src/kinds/board-style.js',
  'src/kinds/board.js',
  'src/export/render-io.js',
  'src/export/export-png.js',
  'src/cloud/cloud-state.js',
  'src/cloud/cloud-sync.js',
  'src/cloud/cloud-pull.js',
  'src/cloud/cloud-groups.js',
  'src/cloud/cloud-group-tabs.js',
  'src/cloud/cloud-group-order.js',
  'src/cloud/cloud-delete.js',
  'src/cloud/cloud-share.js',
  'src/cloud/cloud-short-link.js',
  'src/cloud/cloud-shares.js',
  'src/cloud/cloud-search.js',
  'src/chrome/canvas-view.js',
  'src/chrome/confirm.js',
  'src/chrome/create-kind-dialog.js',
  'src/chrome/chrome-boot.js',
  'src/chrome/source-lines.js',
  'src/chrome/shell-drawer.js',
  'src/chrome/share-dialog.js',
  'src/chrome/shell-tabs.js',
  'src/chrome/shortcuts.js',
  'src/chrome/source-style.js',
].map((rel) => fs.readFileSync(path.join(root, 'packages/drawer-app', rel), 'utf8')).join('\n');
const script = [
  'var DrawerStyleLine = { isMermaidKind: function () { return false; }, isDesignKind: function () { return false; }, bodyKindLabel: function () { return "Boxes"; }, splitRendererStyle: function (t) { return { token: "", body: t }; }, bodyKind: function () { return "boxes"; } };',
  'function stripDocumentMeta(text) { return text; }',
  'function diagramPersistMode() { return "hash"; }',
  'function cloudDiagramIdFromHash() { return ""; }',
  'function cloudShareIdFromHash() { return ""; }',
  'function cloudShortLinkIdFromHash() { return ""; }',
  'function blankHashBoardSource() { return "board \\"Untitled\\"\\n"; }',
  'function encodeDiagramHash() { return Promise.resolve("z:stub"); }',
  'function decodeDiagramHash() { return Promise.resolve({ bmd: "", version: 1 }); }',
  'var DrawerEarlyHead = { safeStorage: function () { return { getItem: function () { return null; }, setItem: function () {} }; }, isLegalHash: function () { return true; }, shouldBlankStart: function () { return false; }, isAuthReturn: function () { return false; } };',
  'var FlowchartTypeScale = { px: function () { return 16; }, applyToRoot: function () {} };',
  'var DrawerPeleTheme = { polishBoxes: function () {} };',
  srcState,
].join('\n')
  .replace(/^import \{[\s\S]*?\} from ['"][^'"]+['"];\n/gm, '')
  .replace(/^import .*$/gm, 'var snapdom = {};')
  .replace(/^export \{[\s\S]*?\};/gm, '')
  .replace(/^export (async )?function /gm, '$1function ')
  .replace(/^export const /gm, 'const ')
  .replace(/^export let /gm, 'let ')
  .replace(/^export var /gm, 'var ')
  .replace(/^export default \{[\s\S]*?\n\};/gm, '')
  .replace(/^export default .*$/gm, '');

// Anything not stubbed by hand answers with another inert stub (callable, with any property).
function inert() {
  const fn = function () { return inert(); };
  return new Proxy(fn, {
    get: (_t, key) => (key === Symbol.toPrimitive ? () => '' : key === 'then' ? undefined : key === 'length' ? 0 : inert()),
    set: () => true,
    apply: () => inert(),
    construct: () => inert(),
  });
}
function stub(own) {
  const base = inert();
  return new Proxy(base, { get: (t, key) => (key in own ? own[key] : t[key]), set: () => true });
}

function load(hash) {
  const listeners = [];
  const dockBtn = stub({
    getAttribute: () => 'props',
    addEventListener: (type, fn) => listeners.push({ type, fn }),
  });
  const withDock = (own) => stub(Object.assign({ querySelectorAll: (sel) => (sel === '[data-dock]' ? [dockBtn] : []) }, own));
  const document = stub({
    getElementById: () => withDock({}),
    querySelectorAll: () => [],
    querySelector: () => withDock({}),
    documentElement: withDock({}),
    body: withDock({}),
    addEventListener() {},
    readyState: 'complete',
  });
  const store = {};
  const sandbox = {
    BoardStyleToken: Token,
    console, URL, URLSearchParams, TextEncoder, TextDecoder, Promise, Blob,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0,
    location: { hash, hostname: 'preview.luluboard.app', href: 'https://preview.luluboard.app/' + hash, pathname: '/', search: '', origin: 'https://preview.luluboard.app' },
    document,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem(k, v) { store[k] = String(v); }, removeItem(k) { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    innerWidth: 1280, innerHeight: 800, navigator: {}, history: { replaceState() {} }, addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    MutationObserver: class { observe() {} }, ResizeObserver: class { observe() {} }, Image: class {}, HTMLTextAreaElement: class {},
    fetch: () => new Promise(() => {}),
  };
  // globals other scripts of the page provide (the supabase client): answer with inert stubs
  const vendorGlobal = /^(Board[A-Z]\w*|LuluBoard\w*)$/;
  const global = new Proxy(sandbox, {
    has: (t, key) => key in t || (typeof key === 'string' && vendorGlobal.test(key)),
    get: (t, key) => {
      if (key in t) return t[key];
      if (key === 'BoxesRender') return { render: () => Promise.resolve(inert()) };
      if (typeof key === 'string' && vendorGlobal.test(key)) return inert();
      return globalThis[key]; // built-ins (Math, JSON, ...)
    },
  });
  sandbox.window = global;
  sandbox.globalThis = global;
  // the page's named elements (id="diagramDock" ...) are globals in a browser
  ['diagramDock', 'boardCanvas', 'diagramSource'].forEach((id) => { sandbox[id] = withDock({}); });
  const ctx = vm.createContext(global);
  // the script has a top-level await (it is a module in the page); the part before it runs synchronously
  const done = vm.runInContext('(async function () {\n' + script + '\n})()', ctx, { filename: 'drawer-app.js' });
  return { done, listeners };
}

(async () => {
  for (const hash of ['#b:b_4dd12be1', '']) {
    const { done, listeners } = load(hash);
    const first = await Promise.race([done.then(() => null, (e) => e), new Promise((r) => setImmediate(() => r(null)))]);
    assert.strictEqual(first, null, 'no top-level throw for hash "' + hash + '": ' + (first && first.stack));
    assert.ok(listeners.some((l) => l.type === 'click'), 'Dock buttons are wired for hash "' + hash + '"');
  }
  console.log('ok 00-bundle-boot');
})().catch((e) => { console.error(e); process.exit(1); });
