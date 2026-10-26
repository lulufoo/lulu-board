import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Themes = require('../../../packages/boxes/themes');

// exactly three themes; an id that is no longer shipped resolves to default instead of throwing
assert.deepStrictEqual(Themes.list().map((t) => t.id), ['default', 'classic', 'pastel']);
assert.strictEqual(Themes.resolveId('a-theme-that-was-removed'), 'default');
assert.strictEqual(Themes.get('a-theme-that-was-removed').id, 'default');

// the theme menu offers the same three
const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
const sel = html.slice(html.indexOf('id="kindThemeSelect"'), html.indexOf('</select>', html.indexOf('id="kindThemeSelect"')));
const menu = Array.from(sel.matchAll(/<option value="([a-z]+)">/g)).map((m) => m[1]);
assert.deepStrictEqual(menu, ['default', 'classic', 'pastel']);
console.log('ok themes-list');
