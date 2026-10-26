import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const srcDir = path.join(root, 'packages/drawer-app/src');
const { SHORTCUT_GROUPS, shortcutKeyLabel, shortcutIsTyping } = require(path.join(srcDir, 'chrome/shortcuts.js'));
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-app/drawer.mjs'), 'utf8');

assert.deepStrictEqual(SHORTCUT_GROUPS.map((g) => g.title), ['Workspace', 'Canvas', 'Selection', 'Text']);
// every listed shortcut points at a real binding in the app source
for (const group of SHORTCUT_GROUPS) {
  for (const row of group.rows) {
    assert.ok(row.label && row.keys.length, 'row has a label and keys');
    assert.ok(row.src.startsWith('src/'), `"${row.label}" src is under src/`);
    const src = fs.readFileSync(path.join(root, 'packages/drawer-app', row.src), 'utf8');
    assert.ok(src.includes(row.probe), `"${row.label}" is bound in ${row.src} (${row.probe})`);
  }
}
assert.strictEqual(shortcutKeyLabel('Mod', true), '⌘');
assert.strictEqual(shortcutKeyLabel('Mod', false), 'Ctrl');
assert.strictEqual(shortcutKeyLabel('Alt', true), '⌥');
assert.strictEqual(shortcutKeyLabel('Alt', false), 'Alt');
assert.ok(shortcutIsTyping({ tagName: 'TEXTAREA' }) && !shortcutIsTyping({ tagName: 'DIV' }), '? is skipped while typing');

assert.match(html, /id="btnDiagramHelp"[^>]*aria-haspopup="dialog"/, 'dock ? opens Keyboard shortcuts');
assert.match(html, /id="shortcutsDialog"[\s\S]*role="dialog" aria-modal="true" aria-labelledby="shortcutsTitle"/, 'shortcuts dialog reuses the modal shell');
assert.match(html, />Keyboard shortcuts</, 'dialog title');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/chrome/shortcuts.js')), 'bundle includes the shortcuts dialog');
console.log('ok shortcuts');
