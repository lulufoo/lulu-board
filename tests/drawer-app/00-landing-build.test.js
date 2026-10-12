'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const landingRel = 'packages/drawer-app/landing';

// what build.mjs ships into .cache/web/landing/
const build = read('scripts/web-build/build.mjs');
const block = build.slice(build.indexOf('const landingSrc'), build.indexOf("rmSync(path.join(webDir, 'css')"));
assert.ok(block.length > 0, 'build.mjs has a landing block');
const shipped = new Set();
for (const m of block.matchAll(/'([^'\n]+\.[a-z0-9]+)'/g)) {
  const name = m[1];
  if (name.startsWith('examples/')) continue; // source half of a [from, to] pair
  shipped.add(name);
}
for (const required of ['index.html', 'landing-base.css', 'landing-sections.css', 'landing.js', 'hero-art.jpg', 'agent-chat.webp', 'board-shot.webp']) {
  assert.ok(shipped.has(required), 'build ships ' + required);
}

// every shipped file lives in the package; nothing is copied from examples/ any more
const fromExamples = [...block.matchAll(/\['(examples\/[^']+)', '([^']+)'\]/g)];
assert.strictEqual(fromExamples.length, 0, 'no screenshot is copied from examples/');
for (const [, from, to] of fromExamples) {
  assert.ok(fs.existsSync(path.join(root, from)), 'example exists: ' + from);
  shipped.add(to);
}
for (const name of shipped) {
  const inPackage = fs.existsSync(path.join(root, landingRel, name));
  const inExamples = fromExamples.some(([, , to]) => to === name);
  assert.ok(inPackage || inExamples, 'source exists for ' + name);
}

// everything the page or its CSS loads locally is shipped
const referenced = new Set();
const collect = (text, dir) => {
  for (const m of text.matchAll(/(?:href|src)="(\.\/[^"#?]+)"|url\("(\.\/[^"#?]+)"\)/g)) {
    referenced.add(path.posix.normalize(path.posix.join(dir, m[1] || m[2])));
  }
};
collect(read(landingRel + '/index.html'), '');
for (const css of ['landing-base.css', 'landing-sections.css']) collect(read(landingRel + '/' + css), '');
assert.ok(referenced.size >= 8, 'the page references local assets');
for (const name of referenced) assert.ok(shipped.has(name), 'referenced asset is shipped: ' + name);

// /landing redirects to /landing/ only with this html handling; do not rely on the default
assert.match(read('wrangler.toml'), /^html_handling\s*=\s*"auto-trailing-slash"$/m, 'wrangler pins html_handling');

console.log('ok landing-build');
