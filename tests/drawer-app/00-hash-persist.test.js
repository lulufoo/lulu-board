'use strict';
const assert = require('assert');
const zlib = require('zlib');
const Hash = require('../../packages/drawer-app/js/00-hash-persist.js');

{
  const mode = Hash.boardPersistMode();
  assert.ok(mode === 'hash' || mode === 'local');
}

{
  const src = 'board "Hi"\nbox A 405 "Code"\n';
  Hash.encodeBoardHash(src, 4).then(async (token) => {
    assert.match(token, /^z:[A-Za-z0-9_-]+$/);
    const back = await Hash.decodeBoardHash(token);
    assert.strictEqual(back.bmd, src);
    assert.strictEqual(back.version, 4);
    const payload = JSON.stringify({ bmd: src, version: 1 });
    const py = zlib.deflateSync(Buffer.from(payload, 'utf8'));
    const b64 = py.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const fromPy = await Hash.decodeBoardHash('z:' + b64);
    assert.strictEqual(fromPy.bmd, src);
    assert.strictEqual(fromPy.version, 1);
    console.log('ok hash-persist');
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
