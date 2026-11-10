import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const tokens = read('packages/board-app/workspace/src/cloud/cloud-tokens.js');
const dialog = read('packages/board-app/workspace/src/chrome/settings-dialog.js');
const barrel = read('packages/board-app/workspace/src/index.js');

assert.ok(fs.existsSync(path.join(root, 'packages/board-app/workspace/src/cloud/cloud-tokens.js')), 'token helper is in the drawer bundle');
assert.match(barrel, /cloud\/cloud-tokens\.js/, 'the barrel re-exports token helpers');
assert.match(tokens, /https:\/\/api\.luluboard\.app/, 'tokens go through board-api');
assert.match(tokens, /tokenRequest\('\/tokens', 'GET'\)/);
assert.match(tokens, /tokenRequest\('\/tokens', 'POST'/);
assert.match(tokens, /tokenRequest\('\/tokens\/revoke', 'POST'/);
assert.match(tokens, /expires_in_days/);
assert.doesNotMatch(tokens, /token_hash|localStorage|sessionStorage/);
assert.match(dialog, /from '\.\.\/cloud\/cloud-tokens\.js'/);
assert.doesNotMatch(tokens + dialog, /localStorage|sessionStorage/);
console.log('ok 06-cloud-tokens');
