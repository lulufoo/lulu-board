'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require('../../packages/drawer-app/js/00-style-line.js');

function b64(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

{
  const token = b64({ theme: 'kami' });
  const src = `%% style ${token}\nflowchart LR\n  A --> B\n  style A fill:#f9f\n`;
  const split = Style.splitRendererStyle(src);
  assert.strictEqual(split.token, token);
  assert.ok(split.body.startsWith('flowchart LR'), split.body);
  assert.ok(split.body.includes('style A fill:#f9f'), split.body);
  assert.strictEqual(Style.joinRendererStyle(token, split.body), src);
}

{
  const token = b64({ theme: 'kami' });
  const split = Style.splitRendererStyle(`style ${token}\nflowchart LR\n  A --> B\n`);
  assert.strictEqual(split.token, token);
  assert.ok(split.body.startsWith('flowchart LR'), split.body);
  assert.strictEqual(Style.joinRendererStyle(token, split.body), `%% style ${token}\n` + split.body);
}

{
  const token = b64({ theme: 'kami' });
  const body = 'board "Demo"\nitem X type text "Hi"\n';
  assert.strictEqual(Style.joinRendererStyle(token, body), `style ${token}\n` + body);
  assert.strictEqual(Style.splitRendererStyle(`style ${token}\n` + body).token, token);
}

{
  const src = 'flowchart LR\n  style A fill:#f9f\n';
  const split = Style.splitRendererStyle(src);
  assert.strictEqual(split.token, '');
  assert.strictEqual(split.body, src);
}

{
  assert.strictEqual(Style.isRendererStyleLine('style eyJ0aGVtZSI6ImthbWkifQ=='), true);
  assert.strictEqual(Style.isRendererStyleLine('%% style eyJ0aGVtZSI6ImthbWkifQ=='), true);
  assert.strictEqual(Style.isRendererStyleLine('style A fill:#f9f'), false);
  assert.strictEqual(Style.bodyIsBoard('board "Demo"\nstyle xxx\n'), true);
  assert.strictEqual(Style.bodyIsBoard('style xxx\nflowchart LR\n'), false);
}

{
  const encode = (obj) => b64(obj);
  const decode = (token) => token ? JSON.parse(Buffer.from(token, 'base64').toString('utf8')) : {};
  const kami = Style.applyMermaidStylePatch('', { theme: 'kami', item_cap: 24 }, encode, decode);
  assert.deepStrictEqual(JSON.parse(Buffer.from(kami, 'base64').toString('utf8')), { theme: 'kami' });
  const back = Style.applyMermaidStylePatch(kami, { theme: 'default' }, encode, decode);
  assert.strictEqual(back, '');
  assert.deepStrictEqual(Style.authoredMermaidStyle({ theme: 'pastel', item_cap: 20, link_route: 'stagger' }), {
    theme: 'pastel',
  });
  assert.deepStrictEqual(
    Style.authoredMermaidStyle({ theme: 'pastel', viewport: { scale: 1.1, x: 8.2, y: 16 } }),
    { theme: 'pastel', viewport: { scale: 1.1, x: 8, y: 16 } },
  );
  assert.deepStrictEqual(
    Style.authoredMermaidStyle({ theme: 'kami', view: { scale: 0.7, x: 3, y: 4 } }),
    { theme: 'kami', viewport: { scale: 0.7, x: 3, y: 4 } },
  );
  const viewOnly = Style.applyMermaidStylePatch('', { viewport: { scale: 0.8, x: 12, y: 24 } }, encode, decode);
  assert.deepStrictEqual(JSON.parse(Buffer.from(viewOnly, 'base64').toString('utf8')), {
    viewport: { scale: 0.8, x: 12, y: 24 },
  });
}

{
  const mermaidSkill = fs.readFileSync(path.join(__dirname, '../../skill/mermaid/SKILL.md'), 'utf8');
  const drawerSkill = fs.readFileSync(path.join(__dirname, '../../skill/drawer/SKILL.md'), 'utf8');
  const chrome = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
  const renderIo = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/05-render-io.js'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/01-shell-state.js'), 'utf8');
  assert.ok(/Mint without `%% meta` or `%% style`/.test(mermaidSkill), 'mermaid SKILL mints without stash');
  assert.ok(!/item_cap|link_route/.test(mermaidSkill), 'mermaid SKILL hides style keys');
  assert.ok(/Omit on mint; do not change on update/.test(drawerSkill), 'drawer SKILL names stash rule');
  assert.ok(/persistMermaidStyle/.test(chrome), 'theme click can persist mermaid style');
  assert.ok(/skipRender/.test(chrome), 'applyDiagramTheme can skip render');
  assert.ok(/applyMermaidDocumentStyle/.test(renderIo), 'render strips mermaid style before Mermaid');
  assert.ok(/DrawerStyleLine\.isRendererStyleLine/.test(shell), 'diagramType skips stash line');
  assert.ok(/!DrawerStyleLine\.bodyIsBoard/.test(shell) || /bodyIsBoard\(body\)/.test(shell), 'wrap keeps board style');
}

console.log('ok mermaid-style-theme');
