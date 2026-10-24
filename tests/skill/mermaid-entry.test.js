'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const pack = fs.readFileSync(path.join(root, 'skill/SKILL.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skill/mermaid/SKILL.md'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'skill/references/cloud.md'), 'utf8');
const pointers = fs.readFileSync(path.join(root, 'skill/references/pointers.md'), 'utf8');

assert.match(pack, /`boxes\/`/, 'pack lists boxes/');
assert.match(pack, /`mermaid\/`/, 'pack lists mermaid/');
assert.match(skill, /Author Mermaid 12\.1\.0/, 'syntax is Mermaid 12.1.0');
assert.match(skill, /Pele 1\.7\.0/, 'renderer is Pele 1.7.0');
assert.match(skill, /not\s+Mermaid\.js/, 'does not load Mermaid.js');
assert.match(skill, /\*\*Open\*\* is `flowchart`[\s\S]*Design group/, 'flowchart, mindmap, and Design are open');
assert.match(skill, /`sequence`[\s\S]*`railroad`/, 'Design kinds are named in route');
assert.match(skill, /A closed type/, 'closed types stop');
assert.match(cloud, /create_diagram/, 'cloud create uses MCP');
assert.match(cloud, /get_diagram/, 'cloud update reads first');
assert.match(cloud, /save_diagram/, 'cloud update writes through MCP');
assert.match(cloud, /Pass the Source as `bmd`/, 'flowchart body uses the bmd field');
assert.match(skill, /\$DRAWER_CTL preview --kind flowchart/, 'short-link preview uses flowchart');
assert.match(skill, /\$DRAWER_CTL preview --kind mindmap/, 'short-link preview uses mindmap');
assert.match(skill, /\$DRAWER_CTL preview --kind sequence/, 'short-link preview uses a Design kind');
assert.match(skill, /show only the CLI stdout `url`/, 'short-link mode prints only the returned url');
assert.match(pointers, /#b:<diagram_id>/, 'pointers document the #b: URL');
assert.match(skill, /Do not mention MCP/, 'disconnected short-link mode stays quiet');
assert.match(pointers, /diagram_id/, 'cloud id is diagram_id');
assert.doesNotMatch(skill, /MMD ID/, 'does not keep local MMD ID');
assert.doesNotMatch(skill, /history\/\*\.mmd/, 'does not use local mermaid history');
assert.doesNotMatch(skill, /\$DRAWER_CTL mount/, 'does not mount a local drawer');

console.log('ok mermaid-entry skill');
