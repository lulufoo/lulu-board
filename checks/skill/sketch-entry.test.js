import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const STUB = 'https://luluboard.app/#p:p_' + 'd'.repeat(64);

const root = path.join(__dirname, '../..');
const pack = fs.readFileSync(path.join(root, 'skills/SKILL.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skills/sketch/SKILL.md'), 'utf8');
const script = path.join(root, 'skills/sketch/scripts/sketch_control.py');

assert.match(pack, /`sketch\/`/, 'pack lists sketch/');
assert.match(skill, /\$SKETCH_CTL preview --kind sketch/, 'preview kind is sketch');
assert.match(skill, /`sketch "<title>"`/, 'the source example carries a title placeholder');
assert.doesNotMatch(skill, /sketch ""/, 'no example with an empty title');
assert.match(skill, /Always write a short title that names the diagram/, 'skill asks for a title');
assert.doesNotMatch(skill, /does not run scripts|The picture is static/, 'skill no longer says scripts are unsupported');
assert.match(skill, /Scripts run when the sketch mounts/, 'skill says scripts run');
assert.match(skill, /`fetch`, `XMLHttpRequest`, and `WebSocket` are blocked/, 'skill says script network is blocked');
assert.match(skill, /Scripts get no pointer events, so click handlers and `:hover` do nothing/, 'skill says pointer handlers do nothing');
assert.match(skill, /## Performance/, 'skill has a performance section');
assert.match(skill, /Add animation only when the user asks for it/, 'skill limits animation');
assert.match(skill, /Animate only `transform` and `opacity`/, 'skill limits what may animate');
assert.match(skill, /Avoid `filter`, `backdrop-filter`/, 'skill avoids costly effects');
assert.match(skill, /Excludes `<iframe>`, `<object>`, `<embed>`, and `<link>`/, 'skill lists the tags Board removes');
assert.match(skill, /## Render Environment/, 'skill names the render environment');
assert.match(skill, /sandboxed `iframe`/, 'skill says the fragment renders in a sandboxed iframe');
assert.match(skill, /`:root`, `html`, and `body` selectors act on that document/, 'skill says root selectors act on the frame document');
assert.match(skill, /No network/, 'skill states there is no network');
assert.match(skill, /`content`/, 'source names the content line');
assert.match(skill, /Done when the returned short `url` is shown/, 'done is the returned url');
assert.match(skill, /Show only the CLI stdout `url`/, 'show uses the returned url');
assert.match(skill, /creates a new short url/, 'change mints a new short url');
assert.match(skill, /To keep, use `#b:`/, 'keep uses #b:');
assert.doesNotMatch(skill, /content \{/, 'content payload has no braces');
assert.doesNotMatch(skill, /edit token|edit_token/, 'no edit token');
assert.doesNotMatch(skill, /preview` encodes|preview 出/, 'no CLI encode of #z:');

const out = execFileSync('python3', [script, 'preview', '--kind', 'sketch'], {
  input: 'sketch ""\ncontent e30=\n',
  encoding: 'utf8',
  env: Object.assign({}, process.env, { LULU_BOARD_SHORT_LINK_STUB: STUB }),
});
assert.strictEqual(out.trim(), STUB, 'stdout is the returned short url');

const titled = execFileSync('python3', [script, 'preview', '--kind', 'sketch'], {
  input: 'style e30=\nsketch "A quiet board"\ncontent e30=\n',
  encoding: 'utf8',
  env: Object.assign({}, process.env, { LULU_BOARD_SHORT_LINK_STUB: STUB }),
});
assert.strictEqual(titled.trim(), STUB);

console.log('ok sketch-entry skill');
