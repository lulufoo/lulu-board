import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
assert.ok(!fs.existsSync(path.join(root, 'packages/mermaid-themes')), 'no standalone mermaid-themes package');

const BoxesThemes = require('../../packages/boxes/themes/index.js');
const Pele = require('../../packages/drawer-app/src/core/pele-theme.js').default;

const ids = BoxesThemes.list().map((t) => t.id);
assert.deepStrictEqual(ids, ['default', 'classic', 'pastel']);
assert.ok(!ids.includes('kami'));

['default', 'classic', 'pastel'].forEach((id) => {
  const pack = BoxesThemes.get(id);
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
    BoxesThemes.strokeFromFill('var(--pele-surface)'),
    id + ' node stroke is fill darkened 10%',
  );
  assert.strictEqual(
    mapped.themeVariables.primaryBorderColor,
    BoxesThemes.strokeFromFill('var(--pele-surface)'),
  );
  assert.strictEqual(
    mapped.themeVariables.clusterBorder,
    BoxesThemes.strokeFromFill('var(--pele-surface)'),
    id + ' cluster stroke matches node',
  );
  assert.strictEqual(mapped.css['--bf-rgb'], pack.edgeRgb);
  assert.strictEqual(mapped.themeVariables.clusterBkg, pack.colors[0], id + ' group paper matches Board card');
  assert.strictEqual(mapped.css['--pele-radius'], BoxesThemes.BOX_RX + 'px', id + ' radius matches flowchart box');
});

const darkMapped = Pele.mapPack('dark');
assert.strictEqual(darkMapped.css['--pele-fg'], BoxesThemes.get('dark').color);
assert.strictEqual(darkMapped.css['--pele-surface'], BoxesThemes.get('dark').colors[0]);
assert.strictEqual(darkMapped.css['--bf-rgb'], BoxesThemes.get('dark').edgeRgb);

const defaultMapped = Pele.mapPack('default');
assert.strictEqual(defaultMapped.css['--pele-border'], 'color-mix(in srgb, var(--pele-surface) 90%, rgb(var(--bf-rgb, 74, 53, 36)))');
assert.strictEqual(defaultMapped.themeVariables.clusterBorder, 'color-mix(in srgb, var(--pele-surface) 90%, rgb(var(--bf-rgb, 74, 53, 36)))');
assert.strictEqual(defaultMapped.css['--pele-muted'], BoxesThemes.get('default').edgeLabel);
assert.strictEqual(defaultMapped.css['--pele-radius'], '4px', 'flowchart corner matches the baked box');
assert.strictEqual(defaultMapped.themeVariables.clusterBkg, BoxesThemes.get('default').colors[0], 'group paper is the Board card fill');
assert.doesNotMatch(fs.readFileSync(path.join(root, 'packages/drawer-app/src/core/pele-theme.js'), 'utf8'), /#5b7bd5/, 'no Pele blue fallback in the mapper');
assert.match(defaultMapped.css['--pele-font'], /SF Pro Text/);

const chrome = fs.readFileSync(path.join(root, 'packages/drawer-app/src/chrome/chrome-boot.js'), 'utf8');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/board-style.js'), 'utf8');
const diagramJs = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/diagram.js'), 'utf8');
assert.match(chrome, /applyPeleThemeVars/, 'host maps Board packs onto Pele');
assert.match(boardJs, /persistMermaidStyle/, 'flowchart writes %% style');
assert.doesNotMatch(boardJs, /MermaidFlowchartThemes/, 'mermaid-ext does not own theme packs');
assert.doesNotMatch(diagramJs, /svg\.style\.width/, 'fixSvgIntrinsic must not rewrite SVG style');
assert.match(diagramJs, /var PELE_VIEW_SCALE = 1\.5/, 'Pele 100% shows 150% size');
assert.match(diagramJs, /DrawerPeleTheme\.polishBoxes/, 'Pele paint bakes the shared box radius');

console.log('ok pele-theme');
