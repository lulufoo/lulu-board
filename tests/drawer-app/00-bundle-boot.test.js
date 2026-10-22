'use strict';
// Loads the whole built drawer script (every file in build order, as one script) against a recording DOM stub,
// for a cloud-board URL (#b:...). A top-level throw anywhere stops the rest of the script, and the Dock icons
// are wired near the end of it, so that is what the test watches for.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const build = fs.readFileSync(path.join(root, 'scripts/drawer-app-build/build.mjs'), 'utf8');
const start = build.indexOf('const domain = [');
const files = [...build.slice(start, build.indexOf('];', start)).matchAll(/'([^']+\.js)'/g)].map((m) => m[1]);
assert.ok(files.length > 20 && files.includes('01-shell-state.js') && files.includes('07-chrome-boot.js'), 'build list was read');
const script = [
  fs.readFileSync(path.join(root, 'packages/board/engine/style-token.js'), 'utf8'),
].concat(files.map((f) => fs.readFileSync(path.join(root, 'packages/drawer-app/js', f), 'utf8')))
  .join('\n')
  .replace(/^import .*$/gm, 'var snapdom = {};');

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
  // globals other scripts of the page provide (board.min.js, the supabase client): answer with inert stubs
  const vendorGlobal = /^(Board[A-Z]\w*|LuluBoard\w*)$/;
  const global = new Proxy(sandbox, {
    has: (t, key) => key in t || (typeof key === 'string' && vendorGlobal.test(key)),
    get: (t, key) => {
      if (key in t) return t[key];
      if (key === 'BoardRender') return { render: () => Promise.resolve(inert()) };
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
