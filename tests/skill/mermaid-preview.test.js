'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '../..');
const ctl = path.join(root, 'skill/mermaid/scripts/drawer_control.py');
const viewer = fs.readFileSync(path.join(root, 'skill/mermaid/references/viewer.md'), 'utf8');
const pointers = fs.readFileSync(path.join(root, 'skill/references/pointers.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skill/mermaid/SKILL.md'), 'utf8');

assert.match(pointers, /`preview` encodes `\{bmd, version\}`/, 'pointers encode the hash envelope');
assert.match(pointers, /CLI preview never mints `#b:`/, 'preview stays unsigned');
assert.match(viewer, /`--kind flowchart` or `--kind mindmap`/, 'viewer pins open kinds');
assert.match(viewer, /does not write `history\/`/, 'preview does not write history');
assert.match(skill, /\$DRAWER_CTL preview --kind flowchart/, 'skill still calls flowchart preview');
assert.match(skill, /\$DRAWER_CTL preview --kind mindmap/, 'skill still calls mindmap preview');

function run(args, input) {
  return spawnSync('python3', [ctl, ...args], {
    input: input == null ? undefined : input,
    encoding: 'utf8',
    cwd: path.join(root, 'skill/mermaid'),
  });
}

const empty = run(['preview', '--kind', 'flowchart', '--no-open'], '');
assert.strictEqual(empty.status, 0, empty.stderr);
const emptyJson = JSON.parse(empty.stdout);
assert.strictEqual(emptyJson.ok, true);
assert.strictEqual(emptyJson.kind, 'flowchart');
assert.strictEqual(emptyJson.open, 'current');
assert.strictEqual(emptyJson.url, 'https://luluvela.app/');

const drawn = run(['preview', '--kind', 'flowchart', '--no-open'], 'flowchart LR\n  A --> B\n');
assert.strictEqual(drawn.status, 0, drawn.stderr);
const drawnJson = JSON.parse(drawn.stdout);
assert.strictEqual(drawnJson.ok, true);
assert.strictEqual(drawnJson.kind, 'flowchart');
assert.strictEqual(drawnJson.open, 'created');
assert.match(drawnJson.url, /^https:\/\/luluvela\.app\/#z:/);
assert.strictEqual(drawnJson.version, 1);

const mindmapDrawn = run(['preview', '--kind', 'mindmap', '--no-open'], 'mindmap\n  Topic\n');
assert.strictEqual(mindmapDrawn.status, 0, mindmapDrawn.stderr);
const mindmapJson = JSON.parse(mindmapDrawn.stdout);
assert.strictEqual(mindmapJson.ok, true);
assert.strictEqual(mindmapJson.kind, 'mindmap');
assert.strictEqual(mindmapJson.open, 'created');
assert.match(mindmapJson.url, /^https:\/\/luluvela\.app\/#z:/);

const titled = run(
  ['preview', '--kind', 'flowchart', '--no-open'],
  '%% title Checkout\nflowchart LR\n  A --> B\n'
);
assert.strictEqual(titled.status, 0, titled.stderr);
assert.strictEqual(JSON.parse(titled.stdout).title, 'Checkout');

const badKind = run(['preview', '--kind', 'board', '--no-open'], 'flowchart LR\n  A --> B\n');
assert.notStrictEqual(badKind.status, 0);

const st = run(['status']);
assert.strictEqual(st.status, 0, st.stderr);
assert.strictEqual(JSON.parse(st.stdout).kind, 'flowchart');

console.log('ok mermaid-preview skill');
