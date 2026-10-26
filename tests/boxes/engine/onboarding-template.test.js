import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require('../../../packages/drawer-app/src/core/style-line.js').default;

const src = fs.readFileSync(
  path.join(__dirname, '../../../packages/drawer-app/templates/welcome.bmd'),
  'utf8'
);
assert.ok(!/^\s*meta\s+/.test(src), 'welcome has no document meta');
assert.strictEqual(Style.bodyKind(src), 'sketch');
assert.match(src, /^sketch "What each one is for\."/);
assert.doesNotMatch(src, /(?:style|content)\s+\{/);
assert.doesNotMatch(src, /^boxes /m);
const fragment = Style.decodeSketchContent(src);
assert.match(fragment, /What each one is for\./);
assert.match(fragment, /The AI agent writes it\. You keep the diagram\./);
assert.match(fragment, /Present the idea visually\. Written in HTML\./);
assert.match(fragment, /A structured whiteboard\. Boxes, items, and links\./);
assert.match(fragment, /A professional expression\. Flowchart, mindmap, or design\./);
assert.match(fragment, /content base64\(HTML\)/);
assert.match(fragment, /Use an AI agent to create or edit\./);
assert.match(fragment, /Use the canvas to collaborate\./);
assert.doesNotMatch(fragment, /<script/i);
assert.ok(!src.includes('Welcome to Lulu Board'), src);
assert.ok(!src.includes('/board login flow'), src);
console.log('ok onboarding-template');
