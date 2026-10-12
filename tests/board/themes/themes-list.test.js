'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Themes = require('../../../packages/board/themes');

// exactly three themes; an id that is no longer shipped resolves to default instead of throwing
assert.deepStrictEqual(Themes.list().map((t) => t.id), ['default', 'classic', 'pastel']);
assert.strictEqual(Themes.resolveId('a-theme-that-was-removed'), 'default');
assert.strictEqual(Themes.get('a-theme-that-was-removed').id, 'default');

// the theme menu offers the same three
const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
const menu = Array.from(html.matchAll(/class="btn style-theme-btn theme-item" data-theme="([a-z]+)"/g)).map((m) => m[1]);
assert.deepStrictEqual(menu, ['default', 'classic', 'pastel']);
console.log('ok themes-list');
