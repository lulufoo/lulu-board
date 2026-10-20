'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
assert.ok(!fs.existsSync(path.join(root, 'packages/mermaid-themes')), 'no standalone mermaid-themes package');

const BoardThemes = require('../../packages/board/themes/index.js');
global.BoardThemes = BoardThemes;
const Pele = require('../../packages/drawer-app/js/00-pele-theme.js');

const ids = BoardThemes.list().map((t) => t.id);
assert.deepStrictEqual(ids, ['default', 'classic', 'pastel']);
assert.ok(!ids.includes('kami'));

['default', 'classic', 'pastel'].forEach((id) => {
  const pack = BoardThemes.get(id);
  const mapped = Pele.mapPack(id);
  assert.strictEqual(mapped.css['--pele-fg'], pack.color);
  assert.strictEqual(mapped.css['--pele-line'], pack.edgeStroke);
  assert.strictEqual(mapped.css['--pele-surface'], pack.colors[0]);
  assert.strictEqual(mapped.themeVariables.lineColor, pack.edgeStroke);
  assert.strictEqual(mapped.themeVariables.nodeTextColor, pack.color);
  assert.deepStrictEqual(mapped.series, pack.colors);
});

const chrome = fs.readFileSync(path.join(root, 'packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-board.js'), 'utf8');
assert.match(chrome, /applyPeleThemeVars/, 'host maps Board packs onto Pele');
assert.match(boardJs, /persistMermaidStyle/, 'flowchart writes %% style');
assert.doesNotMatch(boardJs, /MermaidFlowchartThemes/, 'mermaid-ext does not own theme packs');

console.log('ok pele-theme');
