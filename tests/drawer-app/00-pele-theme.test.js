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
  assert.strictEqual(mapped.css['--_s'], 'var(--pele-surface, #f3f3f3)');
  assert.strictEqual(mapped.css['--_fg'], 'var(--pele-fg, #1f1f1f)');
  assert.strictEqual(mapped.themeVariables.lineColor, pack.edgeStroke);
  assert.strictEqual(mapped.themeVariables.nodeTextColor, pack.color);
  assert.deepStrictEqual(mapped.series, pack.colors);
  assert.strictEqual(
    mapped.css['--pele-border'],
    BoardThemes.edgeTint(pack),
    id + ' node stroke is Board edge over fill',
  );
  assert.strictEqual(
    mapped.themeVariables.primaryBorderColor,
    BoardThemes.edgeTint(pack),
  );
  assert.strictEqual(
    mapped.themeVariables.clusterBorder,
    BoardThemes.edgeTint(pack, BoardThemes.EDGE_DASH_ALPHA),
  );
  assert.strictEqual(mapped.css['--bf-rgb'], pack.edgeRgb);
});

const defaultMapped = Pele.mapPack('default');
assert.strictEqual(defaultMapped.css['--pele-border'], 'rgba(74, 53, 36, .14)');
assert.strictEqual(defaultMapped.themeVariables.clusterBorder, 'rgba(74, 53, 36, .3)');
assert.strictEqual(defaultMapped.css['--pele-muted'], BoardThemes.get('default').edgeLabel);
assert.strictEqual(defaultMapped.css['--pele-radius'], '4px', 'Pele node radius is not the Board card 12px');
assert.match(defaultMapped.css['--pele-font'], /SF Pro Text/);

const chrome = fs.readFileSync(path.join(root, 'packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-board.js'), 'utf8');
assert.match(chrome, /applyPeleThemeVars/, 'host maps Board packs onto Pele');
assert.match(boardJs, /persistMermaidStyle/, 'flowchart writes %% style');
assert.doesNotMatch(boardJs, /MermaidFlowchartThemes/, 'mermaid-ext does not own theme packs');
assert.doesNotMatch(boardJs, /svg\.style\.width/, 'fixSvgIntrinsic must not rewrite SVG style');

console.log('ok pele-theme');
