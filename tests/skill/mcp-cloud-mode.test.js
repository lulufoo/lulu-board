'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const skill = fs.readFileSync(path.join(root, 'skill/board/SKILL.md'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'skill/board/references/viewer.md'), 'utf8');
const mcp = JSON.parse(fs.readFileSync(path.join(root, 'skill/mcp.json'), 'utf8'));
const readme = fs.readFileSync(path.join(root, 'skill/README.md'), 'utf8');

assert.equal(mcp.mcpServers['lulu-board'].url, 'https://mcp.luluboard.app/mcp');
assert.match(readme, /mcp\.json/, 'plugin readme ships mcp.json');
assert.match(skill, /## Hash flow/, 'hash flow remains');
assert.match(skill, /\$DRAWER_CTL preview --kind board/, 'hash mode still uses preview');
assert.match(skill, /Keep `url` first/, 'hash mode still prints url first');
assert.match(skill, /Mint without meta or style/, 'stash rule remains');
assert.match(skill, /leave those lines unchanged/, 'update still leaves stash');
assert.match(skill, /## Cloud flow/, 'cloud flow is named');
assert.match(skill, /create_board/, 'cloud create uses MCP');
assert.match(skill, /get_board/, 'cloud update reads first');
assert.match(skill, /save_board/, 'cloud update writes through MCP');
assert.match(skill, /#b:<id>/, 'cloud mode prints a #b: URL');
assert.match(skill, /Do not mention MCP/, 'disconnected hash mode stays quiet');
assert.match(viewer, /`preview` encodes `\{bmd, version\}`/, 'viewer still encodes the hash envelope');
assert.match(viewer, /CLI preview never mints `#b:`/, 'preview stays unsigned');
assert.match(viewer, /`--id` \| leftover; ignored/, 'viewer ignores leftover --id');

console.log('ok mcp-cloud-mode skill');
