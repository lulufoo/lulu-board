import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const boardJs = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/src/kinds/board.js'), 'utf8');

const idAt = html.indexOf('id="boardIdWrap"');
const typeAt = html.indexOf('id="boardTypeField"');
const capAt = html.indexOf('id="boardCapField"');
assert.ok(idAt >= 0 && typeAt > idAt, 'ID field is first');
assert.ok(capAt > typeAt, 'Width Cap follows Type');
const fontAt = html.indexOf('id="boardNodeFontField"');
assert.ok(fontAt > capAt, 'node Font Size follows Width Cap');
assert.ok(/id="boardNodeFontLabel"[^>]*>Font Size</.test(html), 'props label is Font Size');
assert.ok(/id="boardCapLabel">Width Cap</.test(html), 'label is Width Cap');
assert.ok(/aria-label="Width Cap"/.test(html), 'select aria is Width Cap');
assert.ok(!/>Width</.test(html), 'bare Width label removed');
assert.ok(/\.props-field\s*\{[^}]*gap:\s*10px/.test(css), 'field label-to-control gap is 10px');
assert.ok(/\.props-fields\s*\{[^}]*gap:\s*14px/.test(css), 'field groups use 14px');
assert.ok(/Width Cap · /.test(boardJs), 'status names Width Cap');

console.log('ok props-width-cap');
