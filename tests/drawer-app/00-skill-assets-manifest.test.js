'use strict';
// run after `node scripts/web-build/build.mjs`
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const out = path.join(root, '.cache/web/skill-assets');
const src = path.join(root, 'packages/drawer-app/skill-assets');
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));

assert.strictEqual(manifest.version, 1);
const shipped = fs.readdirSync(out).filter((n) => n !== 'manifest.json').sort();
assert.deepStrictEqual(Object.keys(manifest.files).sort(), shipped, 'manifest lists every shipped file');
for (const name of ['vocab.md', 'icons.json']) assert.ok(manifest.files[name], 'manifest has ' + name);
for (const name of shipped) {
  const bytes = fs.readFileSync(path.join(out, name));
  assert.ok(bytes.equals(fs.readFileSync(path.join(src, name))), name + ' shipped as-is');
  const md5 = crypto.createHash('md5').update(bytes).digest('hex');
  assert.strictEqual(manifest.files[name].md5, md5, 'md5 of ' + name);
  assert.strictEqual(manifest.files[name].bytes, bytes.length, 'bytes of ' + name);
}
assert.ok(!fs.existsSync(path.join(src, 'manifest.json')), 'manifest is build output, not in source');

const headers = fs.readFileSync(path.join(root, '.cache/web/_headers'), 'utf8');
assert.match(headers, /^\/skill-assets\/\*\n\s+Cache-Control: no-cache$/m, '_headers no-cache for skill-assets');
console.log('ok skill-assets manifest');
