import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const block = /board-item-type-text \.board-item-text \{[\s\S]*?\}/.exec(css);

assert.ok(block, 'text item color rule exists');
assert.ok(/color:\s*var\(--board-color/.test(block[0]), 'text items use board ink');
assert.ok(!/color:\s*var\(--text/.test(block[0]), 'text items do not use chrome --text');

console.log('ok item-text-color');
