'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const Route = require('../../packages/drawer-app/js/00-cloud-route.js');
const Hash = require('../../packages/drawer-app/js/00-hash-persist.js');

const src = read('packages/drawer-app/js/06-cloud-short-link.js');
const boot = read('packages/drawer-app/js/02-diagram.js');
const early = read('packages/drawer-app/js/00-early-head.js');
const build = read('scripts/drawer-app-build/build.mjs');
const ID = 'p_' + 'a'.repeat(64);
const BMD = 'boxes "LB-417"\n';

assert.match(src, /rpc\("get_short_link", \{ p_id: id \}\)/, 'reads through get_short_link');
assert.match(src, /encodeDiagramHash\(bmd, 1\)/, 'uses the existing #z: encoder');
assert.match(src, /history\.replaceState/, 'jumps in the browser, no Location 302');
assert.doesNotMatch(src, /location\.hash =/, 'does not assign a raw #z: Location');
assert.match(boot, /loadShortLinkByHash\(raw\)/, 'hash bootstrap opens #p:');
assert.match(early, /p:p_\[0-9a-f\]\{64\}/, 'unsigned #p: is a legal hash');
assert.match(build, /06-cloud-short-link\.js/, 'drawer build includes the short-link module');

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
    cloudClient: {
      rpc() {
        return { maybeSingle: async () => rpcResult };
      },
    },
    cloudLoadSeq: 0,
    encodeDiagramHash: Hash.encodeDiagramHash,
    stripDocumentMeta: (text) => text,
    diagramSourceEl: { value: 'stale' },
    diagramDirty: true,
    diagramLocalRev: 9,
    diagramServerRev: 9,
    setStatus() {},
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
