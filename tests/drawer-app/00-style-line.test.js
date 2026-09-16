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
  const body = 'board "Demo"\nitem X type text "Hi"\n';
  assert.strictEqual(Style.joinRendererStyle(token, body), `style ${token}\n` + body);
  assert.strictEqual(Style.splitRendererStyle(`style ${token}\n` + body).token, token);
}

{
  const src = 'board "Demo"\n';
  const split = Style.splitRendererStyle(src);
  assert.strictEqual(split.token, '');
  assert.strictEqual(split.body, src);
}

{
  assert.strictEqual(Style.isRendererStyleLine('style eyJ0aGVtZSI6ImthbWkifQ=='), true);
  assert.strictEqual(Style.isRendererStyleLine('style A fill:#f9f'), false);
  assert.strictEqual(Style.bodyIsBoard('board "Demo"\nstyle xxx\n'), true);
}

{
  const boardSkill = fs.readFileSync(path.join(__dirname, '../../skill/board/SKILL.md'), 'utf8');
  const chrome = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/01-shell-state.js'), 'utf8');
  assert.ok(/Mint without meta or style/.test(boardSkill), 'board SKILL names stash rule');
  assert.ok(/persistBoardStyle/.test(chrome), 'theme click can persist board style');
  assert.ok(/skipRender/.test(chrome), 'applyDiagramTheme can skip render');
  assert.ok(/joinDocument\(doc\.meta/.test(shell), 'wrap rejoins board meta');
}

console.log('ok board-style-theme');
