import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const assert = require('assert');
const Chrome = require('../../packages/drawer-app/src/core/appearance-chrome.js').default;
const { getAppearance } = require('../../packages/board-themes/appearance/index.js');

{
  const light = getAppearance('light');
  const set = {};
  const root = {
    style: { setProperty: (name, value) => { set[name] = value; } },
    dataset: {},
  };
  Chrome.applyChrome(root);
  assert.strictEqual(set['--bg'], light.page.bg);
  assert.strictEqual(set['--dock'], light.dock.dock);
  assert.strictEqual(set['--fill'], light.dock.fill);
  assert.strictEqual(set['--chip'], light.dock.chip);
  assert.strictEqual(set['--src-paper'], light.source.paper);
  assert.strictEqual(set['--src-indent'], light.source.indent);
  assert.strictEqual(set['--ink'], light.dock.ink);
  assert.strictEqual(set['--accent'], light.dock.accent, 'dock accent wins over page accent');
  assert.strictEqual(root.dataset.theme, 'light');
  assert.strictEqual(root.dataset.appearance, 'light');
}

{
  const dark = getAppearance('dark');
  const set = {};
  const root = {
    style: { setProperty: (name, value) => { set[name] = value; } },
    dataset: {},
  };
  Chrome.applyChrome(root, 'dark');
  assert.strictEqual(set['--bg'], dark.page.bg);
  assert.strictEqual(set['--dock'], dark.dock.dock);
  assert.strictEqual(set['--fill'], dark.dock.fill);
  assert.strictEqual(set['--chip'], dark.dock.chip);
  assert.notStrictEqual(set['--chip'], getAppearance('light').dock.chip);
  assert.strictEqual(set['--src-paper'], dark.source.paper);
  assert.strictEqual(set['--src-indent'], dark.source.indent);
  assert.strictEqual(set['--text'], dark.page.text);
  assert.notStrictEqual(set['--bg'], getAppearance('light').page.bg);
  assert.strictEqual(root.dataset.theme, 'dark');
  assert.strictEqual(root.dataset.appearance, 'dark');
}

// Dark sets color-scheme: dark on the page. The Sketch runner is a light page, so its frame
// must stay pinned to light or the browser paints it as an opaque white block.
{
  const fs = require('fs');
  const path = require('path');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const css = fs.readFileSync(path.join(here, '../../packages/drawer-app/css/01-base.css'), 'utf8');
  assert.match(css, /html\[data-theme="dark"\]\s*\{\s*color-scheme:\s*dark;?\s*\}/, 'Dark page scheme');
  assert.match(css, /iframe\.sketch-frame\s*\{\s*color-scheme:\s*light;?\s*\}/, 'Sketch frame stays light');
}

console.log('ok appearance-chrome');
