import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Layout = require('../../../packages/boxes/engine/layout').default;
const Render = require('../../../packages/boxes/engine/render.js').default;

const src = fs.readFileSync(
  path.join(__dirname, '../../../skill/boxes/templates/demo.bmd'),
  'utf8'
);
assert.ok(!/^\s*meta\s+/.test(src), 'demo has no document meta');
const board = Render.parse(src);
assert.strictEqual(board.title, 'Boxes');
assert.ok(board.boxes.some((b) => b.id === 'CARD'));
assert.ok(board.boxes.some((b) => b.id === 'GROUP' && String(b.type || b.kind) === 'container'));
const out = Render.serialize(board);
assert.ok(out.includes('item GATE shape diamond'), out);
assert.ok(out.includes('CARD <-> NEXT'), out);
assert.ok(out.includes('pin CARD.start to parent.start -31'), out);
assert.ok(out.includes('pin NEXT.top to parent.top 503'), out);
assert.ok(!out.includes('justify'), out);
assert.ok(!out.includes('barrier'), out);
assert.ok(/\btype\s+icon\b/.test(src), 'demo uses type icon');
assert.ok(!/\btype\s+img\b/.test(src), 'demo has no type img');
assert.ok(out.includes('item MARK type icon 008'), out);
console.log('ok demo-template');
