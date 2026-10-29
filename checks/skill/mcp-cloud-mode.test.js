import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const skill = fs.readFileSync(path.join(root, 'skill/boxes/SKILL.md'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'skill/boxes/references/viewer.md'), 'utf8');
const pointers = fs.readFileSync(path.join(root, 'skill/references/pointers.md'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'skill/references/cloud.md'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

assert.match(readme, /https:\/\/mcp\.luluboard\.app\/mcp/, 'readme documents the hosted MCP');
assert.match(skill, /## Short link flow/, 'short link flow remains');
assert.match(skill, /\$DRAWER_CTL preview --kind boxes/, 'short-link mode still uses preview');
assert.match(skill, /show only the CLI stdout `url`/, 'short-link mode prints only the returned url');
assert.match(skill, /Mint without style/, 'stash rule remains');
assert.match(skill, /leave those lines unchanged/, 'update still leaves stash');
assert.match(skill, /## Cloud flow/, 'cloud flow is named');
assert.match(cloud, /create_diagram/, 'cloud create uses MCP');
assert.match(cloud, /get_diagram/, 'cloud update reads first');
assert.match(cloud, /get_group/, 'cloud joins a group via get_group');
assert.match(cloud, /save_diagram/, 'cloud update writes through MCP');
assert.match(pointers, /#b:<diagram_id>/, 'pointers document the #b: URL');
assert.match(skill, /Do not mention MCP/, 'disconnected short-link mode stays quiet');
assert.match(pointers, /\| `#p:` \|/, 'pointers table has #p:');
assert.match(pointers, /It does not encode `#z:`/, 'CLI does not encode #z:');
assert.match(pointers, /It never mints `#b:`/, 'preview stays unsigned');
assert.match(skill, /creates a new short url/, 'change mints a new short url');
assert.match(skill, /To keep, use cloud mode/, 'keep uses #b:');
assert.doesNotMatch(pointers + skill, /edit token|edit_token/, 'no edit token');
assert.doesNotMatch(pointers + skill, /preview` encodes/, 'no CLI encode of #z:');
assert.match(viewer, /`--id` \| leftover; ignored/, 'viewer ignores leftover --id');

console.log('ok mcp-cloud-mode skill');
