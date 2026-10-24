'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '../..');
const pack = fs.readFileSync(path.join(root, 'skill/SKILL.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skill/sketch/SKILL.md'), 'utf8');
const script = path.join(root, 'skill/sketch/scripts/sketch_control.py');

assert.match(pack, /`sketch\/`/, 'pack lists sketch/');
assert.match(skill, /\$SKETCH_CTL preview --kind sketch/, 'preview kind is sketch');
assert.match(skill, /does not run scripts/, 'skill states scripts are unsupported');
assert.match(skill, /`content`/, 'source names the content line');
assert.match(skill, /Done when `\[title\]\(url\)` is shown/, 'done is the markdown link');
assert.match(skill, /Show `\[title\]\(url\)` and stop/, 'show uses CLI title and url');
assert.doesNotMatch(skill, /content \{/, 'content payload has no braces');
assert.doesNotMatch(skill, /Show the URL/, 'skill does not show a bare url');
assert.doesNotMatch(skill, /Keep `url` first/, 'skill does not lead with a bare url');

const out = execFileSync('python3', [script, 'preview', '--kind', 'sketch'], {
  input: 'sketch ""\ncontent e30=\n',
  encoding: 'utf8',
});
const payload = JSON.parse(out);
assert.strictEqual(payload.kind, 'sketch');
assert.strictEqual(payload.title, '');
assert.match(payload.url, /^https:\/\/luluboard\.app\/#z:/, 'url is a public hash');
assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'link'), 'preview has no link field');

const titled = JSON.parse(execFileSync('python3', [script, 'preview', '--kind', 'sketch'], {
  input: 'style e30=\nsketch "A quiet board"\ncontent e30=\n',
  encoding: 'utf8',
}));
assert.strictEqual(titled.title, 'A quiet board');

console.log('ok sketch-entry skill');
