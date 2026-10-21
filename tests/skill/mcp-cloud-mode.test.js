'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const skill = fs.readFileSync(path.join(root, 'skill/board/SKILL.md'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'skill/board/references/viewer.md'), 'utf8');
const pointers = fs.readFileSync(path.join(root, 'skill/references/pointers.md'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'skill/references/cloud.md'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

assert.match(readme, /https:\/\/mcp\.luluvela\.app\/mcp/, 'readme documents the hosted MCP');
assert.match(skill, /## Hash flow/, 'hash flow remains');
assert.match(skill, /\$DRAWER_CTL preview --kind board/, 'hash mode still uses preview');
assert.match(skill, /Keep `url` first/, 'hash mode still prints url first');
assert.match(skill, /Mint without style/, 'stash rule remains');
assert.match(skill, /leave those lines unchanged/, 'update still leaves stash');
assert.match(skill, /## Cloud flow/, 'cloud flow is named');
assert.match(cloud, /create_vela/, 'cloud create uses MCP');
assert.match(cloud, /get_vela/, 'cloud update reads first');
assert.match(cloud, /save_vela/, 'cloud update writes through MCP');
assert.match(pointers, /#b:<vela_id>/, 'pointers document the #b: URL');
assert.match(skill, /Do not mention MCP/, 'disconnected hash mode stays quiet');
assert.match(pointers, /`preview` encodes `\{bmd, version\}`/, 'pointers encode the hash envelope');
assert.match(pointers, /CLI preview never mints `#b:`/, 'preview stays unsigned');
assert.match(viewer, /`--id` \| leftover; ignored/, 'viewer ignores leftover --id');

console.log('ok mcp-cloud-mode skill');
