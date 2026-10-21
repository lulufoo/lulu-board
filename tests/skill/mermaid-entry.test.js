'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const readme = fs.readFileSync(path.join(root, 'skill/README.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skill/mermaid/SKILL.md'), 'utf8');

assert.ok(!fs.existsSync(path.join(root, 'skill/SKILL.md')), 'no pack SKILL at skill root');
assert.match(readme, /`\/board`/, 'pack lists /board');
assert.match(readme, /`\/mermaid`/, 'pack lists /mermaid');
assert.match(readme, /`mermaid\/`/, 'pack points at mermaid/');
assert.match(skill, /Author Mermaid 12\.1\.0/, 'syntax is Mermaid 12.1.0');
assert.match(skill, /Pele 1\.7\.0/, 'renderer is Pele 1.7.0');
assert.match(skill, /not\s+Mermaid\.js/, 'does not load Mermaid.js');
assert.match(skill, /\*\*Open\*\* is only `flowchart`/, 'only flowchart is open');
assert.match(skill, /A closed type/, 'closed types stop');
assert.match(skill, /create_vela/, 'cloud create uses MCP');
assert.match(skill, /get_vela/, 'cloud update reads first');
assert.match(skill, /save_vela/, 'cloud update writes through MCP');
assert.match(skill, /Pass the Source as `bmd`/, 'flowchart body uses the bmd field');
assert.match(skill, /\$DRAWER_CTL preview --kind flowchart/, 'hash preview uses flowchart');
assert.match(skill, /Keep `url` first/, 'hash mode prints url first');
assert.match(skill, /#b:<id>/, 'cloud mode prints a #b: URL');
assert.match(skill, /Do not mention MCP/, 'disconnected hash mode stays quiet');
assert.match(skill, /\*\*Vela ID\*\*/, 'cloud id is Vela ID');
assert.doesNotMatch(skill, /MMD ID/, 'does not keep local MMD ID');
assert.doesNotMatch(skill, /history\/\*\.mmd/, 'does not use local mermaid history');
assert.doesNotMatch(skill, /\$DRAWER_CTL mount/, 'does not mount a local drawer');

console.log('ok mermaid-entry skill');
