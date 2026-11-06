import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// packages/board-app/shared/cross-page-contract.md lists the literals that workspace, landing and
// oauth must agree on without importing each other. This check keeps the doc and the code in step.
const root = path.join(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
// Paths in the doc are relative to packages/board-app/, except scripts/.
const repoPath = (p) => (p.startsWith('scripts/') ? p : 'packages/board-app/' + p);
const doc = read('packages/board-app/shared/cross-page-contract.md');
// whole-identifier match, so LuluBoardSupabase does not pass on LuluBoardSupabaseConfig
const spells = (text, literal) => new RegExp('(?<!\\w)' + literal.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?!\\w)').test(text);

// every row: the literal is in the doc and spelled out in every listed file, and each file is in the doc
const literals = [
  { name: 'stored session key', literal: '/^sb-.+-auth-token$/', files: ['workspace/src/core/early-head.js', 'landing/landing.js'] },
  { name: 'sign-in handoff key', literal: 'lulu-board:open-sign-in', files: ['landing/landing.js', 'workspace/src/cloud/cloud-sync.js'] },
  { name: 'Supabase config global', literal: 'LuluBoardSupabaseConfig', files: ['scripts/build-shared/build.mjs', 'workspace/src/cloud/cloud-sync.js', 'oauth/consent/consent.js'] },
  { name: 'Supabase client global', literal: 'LuluBoardSupabase', files: ['shared/vendor/supabase-client.js', 'workspace/src/cloud/cloud-sync.js', 'oauth/consent/consent.js'] },
  { name: 'Sentry config global', literal: 'LuluBoardSentryConfig', files: ['scripts/build-shared/build.mjs', 'shared/vendor/sentry-client.js'] },
  { name: 'Sentry global', literal: 'Sentry', code: 'window.Sentry', files: ['shared/vendor/sentry-client.js', 'workspace/src/core/sentry-count.js', 'landing/landing.js'] },
];
for (const { name, literal, code = literal, files } of literals) {
  assert.ok(doc.includes('`' + literal + '`'), name + ': the doc lists ' + literal);
  for (const file of files) {
    assert.ok(doc.includes(file), name + ': the doc lists ' + file);
    assert.ok(spells(read(repoPath(file)), code), name + ': ' + file + ' spells out ' + code);
  }
}

// the session key is the Supabase default, so no page may set its own storageKey
assert.doesNotMatch(read('packages/board-app/workspace/src/cloud/cloud-sync.js'), /storageKey/, 'workspace keeps the default session key');
assert.doesNotMatch(read('packages/board-app/oauth/consent/consent.js'), /storageKey/, 'consent keeps the default session key');

// blank board address: the landing Sign in link carries the token early-head treats as blank
const earlyHead = read('packages/board-app/workspace/src/core/early-head.js');
const blank = /BLANK_Z_HASH = "(z:[A-Za-z0-9_-]+)"/.exec(earlyHead);
assert.ok(blank, 'early-head defines BLANK_Z_HASH');
const landingHtml = read('packages/board-app/landing/index.html');
assert.match(
  landingHtml,
  new RegExp('<a [^>]*href="/#' + blank[1] + '"[^>]*data-open-sign-in="menu"'),
  'the landing Sign in link opens the blank board'
);
assert.ok(doc.includes('BLANK_Z_HASH'), 'the doc names BLANK_Z_HASH');

// public URLs
assert.match(earlyHead, /LANDING_PATH = "\/landing\/"/, 'early-head sends visitors to /landing/');
assert.match(earlyHead, /function isForcedWorkspace/, 'early-head keeps /?ws=1 on the workspace');
assert.ok(earlyHead.includes('ws='), 'early-head reads the ws parameter');
assert.match(landingHtml, /href="\/\?ws=1"/, 'landing links to /?ws=1');
const siteBuild = read('scripts/build-site/build.mjs');
assert.match(siteBuild, /path\.join\(webDir, 'landing'\)/, 'build-site serves landing at /landing/');
assert.match(siteBuild, /path\.join\(webDir, 'oauth\/consent'\)/, 'build-site serves consent at /oauth/consent');
for (const url of ['/?ws=1', '/landing/', '/oauth/consent']) {
  assert.ok(doc.includes('`' + url + '`'), 'the doc lists ' + url);
}

// a page that loads a vendor client loads its config script first
for (const rel of ['workspace/index.html', 'landing/index.html', 'oauth/consent/index.html']) {
  const html = read('packages/board-app/' + rel);
  for (const vendor of ['supabase', 'sentry']) {
    const client = html.indexOf(vendor + '-client.js');
    if (client < 0) continue;
    const config = html.indexOf(vendor + '-config.js');
    assert.ok(config >= 0 && config < client, rel + ' loads ' + vendor + '-config.js before the client');
  }
}

console.log('ok cross-page-contract');
