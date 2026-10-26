import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const web = path.join(repo, '.cache/web');
const vendor = path.join(web, 'vendor');
const srcHtml = fs.readFileSync(path.join(repo, 'packages/drawer-app/index.html'), 'utf8');
const outHtml = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const landing = fs.readFileSync(path.join(web, 'landing/index.html'), 'utf8');
const consent = fs.readFileSync(path.join(web, 'oauth/consent/index.html'), 'utf8');
const headers = fs.readFileSync(path.join(web, '_headers'), 'utf8');
const names = fs.readdirSync(vendor).sort();

const hashedLogical = [
  'drawer-app.css',
  'drawer-app.js',
  'drawer-app-early-head.js',
  'drawer-app-early-hydrate.js',
  'supabase-client.js',
  'sentry-client.js',
  'snapdom.mjs',
  'pele.global.js',
];

for (const name of hashedLogical) {
  assert.ok(!names.includes(name), 'vendor no longer keeps unhashed ' + name);
  if (name !== 'snapdom.mjs') {
    assert.match(srcHtml, new RegExp('vendor/' + name.replace(/\./g, '\\.')), 'source html still names ' + name);
    assert.doesNotMatch(outHtml, new RegExp('vendor/' + name.replace(/\./g, '\\.')), 'built html does not keep ' + name);
  }
}

assert.ok(names.includes('supabase-config.js'), 'config stays unhashed');
assert.ok(names.includes('sentry-config.js'), 'sentry config stays unhashed');

const hashed = names.filter((n) => !n.endsWith('-config.js'));
assert.equal(hashed.length, hashedLogical.length, 'every hashed vendor file is present');
for (const name of hashed) {
  assert.match(name, /-[0-9a-f]{8}\.[a-z]+$/, name + ' has an 8-hex content hash');
  assert.match(
    headers,
    new RegExp('/vendor/' + name.replace(/\./g, '\\.') + '\\n\\s+Cache-Control: public, max-age=31536000, immutable'),
    name + ' is immutable',
  );
}

assert.match(headers, /\/index\.html\n\s+Cache-Control: no-cache/, 'html is not immutable');
assert.doesNotMatch(headers, /\/index\.html\n\s+Cache-Control:[^\n]*immutable/, 'html Cache-Control has no immutable');
assert.match(headers, /^\/skill-assets\/\*\n\s+Cache-Control: no-cache$/m, 'skill-assets stay no-cache');

assert.match(outHtml, /vendor\/drawer-app-[0-9a-f]{8}\.js/, 'index points at hashed drawer');
assert.match(landing, /vendor\/sentry-client-[0-9a-f]{8}\.js/, 'landing points at hashed sentry');
assert.match(consent, /vendor\/supabase-client-[0-9a-f]{8}\.js/, 'consent points at hashed supabase');

const drawerName = names.find((n) => n.startsWith('drawer-app-') && n.endsWith('.js') && !n.includes('early'));
const snapName = names.find((n) => n.startsWith('snapdom-'));
const drawer = fs.readFileSync(path.join(vendor, drawerName), 'utf8');
assert.match(drawer, new RegExp(snapName.replace(/\./g, '\\.')), 'drawer import points at hashed snapdom');
assert.doesNotMatch(drawer, /from\s+["']\.\/snapdom\.mjs["']/, 'drawer no longer imports unhashed snapdom');

console.log('ok asset-hash');
