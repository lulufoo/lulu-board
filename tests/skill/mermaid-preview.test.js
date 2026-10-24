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

assert.match(pointers, /\| `#p:` \|/, 'pointers table has #p:');
assert.match(pointers, /It does not encode `#z:`/, 'CLI does not encode #z:');
assert.match(pointers, /It never mints `#b:`/, 'preview stays unsigned');
assert.match(viewer, /`--kind flowchart`, `--kind mindmap`, or a Design kind/, 'viewer pins open kinds');
assert.match(viewer, /does not write `history\/`/, 'preview does not write history');
assert.match(skill, /\$DRAWER_CTL preview --kind flowchart/, 'skill still calls flowchart preview');
assert.match(skill, /\$DRAWER_CTL preview --kind mindmap/, 'skill still calls mindmap preview');
assert.match(skill, /\$DRAWER_CTL preview --kind sequence/, 'skill calls a Design preview');

const STUB = 'https://luluboard.app/#p:p_' + 'a'.repeat(64);

function run(args, input) {
  return spawnSync('python3', [ctl, ...args], {
    input: input == null ? undefined : input,
    encoding: 'utf8',
    cwd: path.join(root, 'skill/mermaid'),
    env: Object.assign({}, process.env, { LULU_BOARD_SHORT_LINK_STUB: STUB }),
  });
}

const empty = run(['preview', '--kind', 'flowchart', '--no-open'], '');
assert.strictEqual(empty.status, 0, empty.stderr);
assert.strictEqual(empty.stdout.trim(), 'https://luluboard.app/');

const drawn = run(['preview', '--kind', 'flowchart', '--no-open'], 'flowchart LR\n  A --> B\n');
assert.strictEqual(drawn.status, 0, drawn.stderr);
assert.strictEqual(drawn.stdout.trim(), STUB);

const mindmapDrawn = run(['preview', '--kind', 'mindmap', '--no-open'], 'mindmap\n  Topic\n');
assert.strictEqual(mindmapDrawn.status, 0, mindmapDrawn.stderr);
assert.strictEqual(mindmapDrawn.stdout.trim(), STUB);

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
  assert.strictEqual(drawn.stdout.trim(), STUB);
});

const titled = run(
  ['preview', '--kind', 'flowchart', '--no-open'],
  '%% title Checkout\nflowchart LR\n  A --> B\n'
);
assert.strictEqual(titled.status, 0, titled.stderr);
assert.strictEqual(titled.stdout.trim(), STUB);

const badKind = run(['preview', '--kind', 'board', '--no-open'], 'flowchart LR\n  A --> B\n');
assert.notStrictEqual(badKind.status, 0);

const st = run(['status']);
assert.strictEqual(st.status, 0, st.stderr);
assert.strictEqual(JSON.parse(st.stdout).kind, 'flowchart');

console.log('ok mermaid-preview skill');
