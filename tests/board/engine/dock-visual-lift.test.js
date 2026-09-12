'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');

assert.ok(/board-dock-tab-icon/.test(html), 'rail tabs have icons');
assert.ok(/data-dock-icon="inspector"/.test(html), 'Properties is an inspector card');
assert.ok(/data-dock-icon="code"/.test(html), 'Source is code brackets');
assert.ok(/data-dock-icon="export"/.test(html), 'Export is box plus outgoing arrow');
assert.ok(/data-dock-icon="palette"/.test(html), 'Style is a palette');
assert.ok(!/writing-mode:\s*vertical-rl/.test(css), 'no sideways rail text');
assert.ok(!/height:\s*84px/.test(css), 'rail tabs are not 84px word stacks');
assert.ok(/\.board-dock-tab-icon/.test(css), 'icon size is styled');
assert.ok(!/class="dock-beta"/.test(html), 'no Board beta pill');
assert.ok(/dock-beta/.test(css), 'Board beta hide rule remains');
assert.ok(/title="Properties"/.test(html), 'Props tab keeps Properties title');
assert.ok(/\.board-dock-resize::after/.test(css), 'resize handle draws a hairline, not a painted slab');
assert.ok(/\.board-dock-resize:hover::after/.test(css), 'hover lights the hairline only');
assert.ok(!/\.board-dock-resize:hover\s*,/.test(css), 'hover does not paint the full handle');

console.log('ok dock-visual-lift');
