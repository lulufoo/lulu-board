import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const zlib = require('zlib');
const Hash = require('../../packages/drawer-app/src/core/hash-persist.js').default;

{
  const mode = Hash.diagramPersistMode();
  assert.ok(mode === 'hash' || mode === 'local');
}

{
  const src = 'board "Hi"\nbox A 405 "Code"\n';
  Hash.encodeDiagramHash(src, 4).then(async (token) => {
    assert.match(token, /^z:[A-Za-z0-9_-]+$/);
    const back = await Hash.decodeDiagramHash(token);
    assert.strictEqual(back.bmd, src);
    assert.strictEqual(back.version, 4);
    const payload = JSON.stringify({ bmd: src, version: 1 });
    const py = zlib.deflateSync(Buffer.from(payload, 'utf8'));
    const b64 = py.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const fromPy = await Hash.decodeDiagramHash('z:' + b64);
    assert.strictEqual(fromPy.bmd, src);
    assert.strictEqual(fromPy.version, 1);
    const flow = 'flowchart TD\n  A-->B\n';
    const flowToken = await Hash.encodeDiagramHash(flow, 1);
    assert.match(flowToken, /^z:[A-Za-z0-9_-]+$/);
    const flowBack = await Hash.decodeDiagramHash(flowToken);
    assert.strictEqual(flowBack.bmd, flow);
    assert.doesNotMatch(flowBack.bmd, /m_[0-9a-f]{8}/);
    console.log('ok hash-persist');
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
