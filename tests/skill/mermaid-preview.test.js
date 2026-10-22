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
assert.match(viewer, /`--kind flowchart`, `--kind mindmap`, or a Design kind/, 'viewer pins open kinds');
assert.match(viewer, /does not write `history\/`/, 'preview does not write history');
assert.match(skill, /\$DRAWER_CTL preview --kind flowchart/, 'skill still calls flowchart preview');
assert.match(skill, /\$DRAWER_CTL preview --kind mindmap/, 'skill still calls mindmap preview');
assert.match(skill, /\$DRAWER_CTL preview --kind sequence/, 'skill calls a Design preview');

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
assert.strictEqual(emptyJson.url, 'https://luluboard.app/');

const drawn = run(['preview', '--kind', 'flowchart', '--no-open'], 'flowchart LR\n  A --> B\n');
assert.strictEqual(drawn.status, 0, drawn.stderr);
const drawnJson = JSON.parse(drawn.stdout);
assert.strictEqual(drawnJson.ok, true);
assert.strictEqual(drawnJson.kind, 'flowchart');
assert.strictEqual(drawnJson.open, 'created');
assert.match(drawnJson.url, /^https:\/\/luluboard\.app\/#z:/);
assert.strictEqual(drawnJson.version, 1);

const mindmapDrawn = run(['preview', '--kind', 'mindmap', '--no-open'], 'mindmap\n  Topic\n');
assert.strictEqual(mindmapDrawn.status, 0, mindmapDrawn.stderr);
const mindmapJson = JSON.parse(mindmapDrawn.stdout);
assert.strictEqual(mindmapJson.ok, true);
assert.strictEqual(mindmapJson.kind, 'mindmap');
assert.strictEqual(mindmapJson.open, 'created');
assert.match(mindmapJson.url, /^https:\/\/luluboard\.app\/#z:/);

const designSeeds = {
  sequence: 'sequenceDiagram\n  actor User\n  participant UI\n  User->>UI: action\n',
  class: 'classDiagram\n  class Service {\n    +run()\n  }\n',
  state: 'stateDiagram-v2\n  [*] --> Idle\n',
  er: 'erDiagram\n  USER ||--o{ NOTE : writes\n',
  requirement: 'requirementDiagram\n  requirement auth {\n    id: 1\n    text: user must sign in\n    risk: high\n    verifymethod: test\n  }\n',
  c4: 'C4Context\n  title System Context — Example\n  Person(user, "User", "Uses the product")\n  System(app, "Example System", "Our system")\n  Rel(user, app, "Uses")\n',
  usecase: 'usecase-beta\nactor Customer\nCheckout("Place order")\nCustomer --> Checkout\n',
  eventmodeling: 'eventmodeling\ntf 01 ui CartUI\ntf 02 cmd AddItem\ntf 03 evt ItemAdded\n',
  railroad: 'railroad-beta\nrule = terminal("hello");\n',
};
Object.keys(designSeeds).forEach(function (kind) {
  const drawn = run(['preview', '--kind', kind, '--no-open'], designSeeds[kind]);
  assert.strictEqual(drawn.status, 0, kind + ' ' + drawn.stderr);
  const json = JSON.parse(drawn.stdout);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.kind, kind);
  assert.strictEqual(json.open, 'created');
  assert.match(json.url, /^https:\/\/luluboard\.app\/#z:/);
});

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
