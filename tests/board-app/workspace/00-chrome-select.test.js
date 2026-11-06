import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const assert = require('assert');

// Chrome with caret browsing on paints a caret at any collapsed selection in plain text.
// The chrome (group tabs, dock labels, hints) is not a text surface, so a click on it must
// not leave a selection. Text entry and the Source error output stay selectable.
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, '../../..', rel), 'utf8');
const css = read('packages/board-app/workspace/css/01-base.css');
const html = read('packages/board-app/workspace/index.html');

// All declarations of every top-level rule with this exact selector, joined.
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/,\s*/g, ',\\s*');
  const matches = [...css.matchAll(new RegExp('(?:^|\\n)' + escaped + '\\s*\\{([^}]*)\\}', 'g'))];
  assert.ok(matches.length, 'rule exists: ' + selector);
  return matches.map((m) => m[1]).join('\n');
}

{
  const body = rule('body');
  assert.match(body, /(?:^|\s)user-select:\s*none;/, 'body is not a text surface');
  assert.match(body, /-webkit-user-select:\s*none;/, 'body is not a text surface in WebKit');
}

{
  const text = rule('input,\ntextarea,\n#diagramError');
  assert.match(text, /(?:^|\s)user-select:\s*text;/, 'text entry and the error output stay selectable');
  assert.match(text, /-webkit-user-select:\s*text;/, 'text entry stays selectable in WebKit');
}

// The selector above names ids and tags that must still exist in the page.
assert.match(html, /<pre id="diagramError">/, 'Source error output exists');
assert.match(html, /<textarea id="diagramSource"/, 'Source editor is a textarea');
assert.match(html, /<input type="text" id="shareLinkInput" readonly/, 'share link is a readonly input');

console.log('ok chrome-select');
