import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const Route = require('../../packages/drawer-app/src/core/cloud-route.js').default;
const Hash = require('../../packages/drawer-app/src/core/hash-persist.js').default;

const src = read('packages/drawer-app/src/cloud/cloud-short-link.js')
  .replace(/^import \{[\s\S]*?\} from ['"][^'"]+['"];\n/gm, '')
  .replace(/^import .*$/gm, '')
  .replace(/^export \{[\s\S]*?\};/gm, '')
  .replace(/^register\(.+$/gm, '');
const boot = read('packages/drawer-app/src/kinds/diagram.js');
const early = read('packages/drawer-app/src/core/early-head.js');
const routeSrc = read('packages/drawer-app/src/core/cloud-route.js');
const build = read('scripts/build-app/drawer.mjs');
const ID = 'p_' + 'a'.repeat(64);
const BMD = 'boxes "LB-417"\n';

assert.match(src, /https:\/\/api\.luluboard\.app\/short-links\/get/, 'reads through the board API');
assert.match(src, /encodeDiagramHash\(bmd, 1\)/, 'uses the existing #z: encoder');
assert.match(src, /history\.replaceState/, 'jumps in the browser, no Location 302');
assert.doesNotMatch(src, /location\.hash =/, 'does not assign a raw #z: Location');
assert.match(boot, /call\("loadShortLinkByHash", raw\)/, 'hash bootstrap opens #p:');
assert.match(routeSrc, /SHORT_LINK_ID_RE = \/\^p_\[0-9a-f\]\{64\}\$/, 'unsigned #p: is a legal hash');
assert.match(early, /SHORT_LINK_ID_RE/, 'early-head accepts #p: via the shared id');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-short-link.js')), 'drawer build includes the short-link module');

function runLoad(rpcResult) {
  const location = { hash: '#p:' + ID, pathname: '/', search: '' };
  const history = {
    replaceState(_s, _t, url) {
      location.hash = url.slice(url.indexOf('#'));
      this.url = url;
    },
  };
  const sandbox = {
    location,
    history,
    cloudShortLinkIdFromHash: Route.cloudShortLinkIdFromHash,
    cloudConfigured: () => true,
    cloudClient: {},
    fetch: async () => {
      if (rpcResult.error) {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ error: rpcResult.error.message }),
        };
      }
      const row = rpcResult.data;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(row ? [row] : []),
      };
    },
    cloudLoadSeq: 0,
    encodeDiagramHash: Hash.encodeDiagramHash,
    stripDocumentMeta: (text) => text,
    diagramSourceEl: { value: 'stale' },
    diagramDirty: true,
    diagramLocalRev: 9,
    diagramServerRev: 9,
    setStatus() {},
    emit(name) { const fn = sandbox[name]; if (typeof fn === 'function') return fn.apply(sandbox, [].slice.call(arguments, 1)); },
    call(name) { const fn = sandbox[name]; if (typeof fn === 'function') return fn.apply(sandbox, [].slice.call(arguments, 1)); },
    bumpCloudLoadSeq() { sandbox.cloudLoadSeq += 1; return sandbox.cloudLoadSeq; },
    setDiagramDirty(v) { sandbox.diagramDirty = !!v; },
    setDiagramLocalRev(n) { sandbox.diagramLocalRev = n; },
    setDiagramServerRev(n) { sandbox.diagramServerRev = n; },
    setShareView() {},
    setShareEdit() {},
    applyDiagramLiveMeta() {},
    updateDiagramChars() {},
    syncSourceDockLabel() {},
    showDiagramError() {},
    renderDiagram() {},
    setDiagramSyncUI() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.loadShortLinkByHash('#p:' + ID).then(() => sandbox);
}

runLoad({ data: { bmd: BMD }, error: null }).then(async (ok) => {
  assert.strictEqual(ok.diagramSourceEl.value, BMD, 'unexpired #p: shows the board');
  assert.match(ok.location.hash, /^#z:[A-Za-z0-9_-]+$/, 'address bar becomes #z:');
  const decoded = await Hash.decodeDiagramHash(ok.location.hash);
  assert.strictEqual(decoded.bmd, BMD);
  return runLoad({ data: null, error: { message: 'Short link not found' } });
}).then((expired) => {
  assert.strictEqual(expired.diagramSourceEl.value, '', 'expired #p: shows no board');
  assert.strictEqual(expired.location.hash, '#p:' + ID, 'failed read stays on #p:');
  console.log('ok cloud-short-link');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
