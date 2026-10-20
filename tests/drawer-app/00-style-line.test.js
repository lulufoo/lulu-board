'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require('../../packages/drawer-app/js/00-style-line.js');

function b64(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

{
  const token = b64({ theme: 'pastel' });
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
  assert.strictEqual(Style.bodyKind('board "Demo"\n'), 'board');
  assert.strictEqual(Style.bodyKind('flowchart TD\nA-->B\n'), 'flowchart');
  assert.strictEqual(Style.bodyKind('graph LR\nA-->B\n'), 'flowchart');
  assert.strictEqual(Style.bodyKind('%% title Demo\nflowchart TD\nA-->B\n'), 'flowchart');
  assert.strictEqual(Style.bodyKind('style default\nflowchart TD\nA-->B\n'), 'flowchart');
  assert.strictEqual(Style.bodyKind('mindmap\nroot((A))\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('sequenceDiagram\nA->>B: hi\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind(''), 'empty');
  assert.strictEqual(Style.bodyKind('not a diagram\n'), 'unknown');
}

{
  const boardSkill = fs.readFileSync(path.join(__dirname, '../../skill/board/SKILL.md'), 'utf8');
  const chrome = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/01-shell-state.js'), 'utf8');
  assert.ok(/Mint without meta or style/.test(boardSkill), 'board SKILL names stash rule');
  assert.ok(/persistBoardStyle/.test(chrome), 'theme click can persist board style');
  const boardJs = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/02-board.js'), 'utf8');
  assert.ok(/updateNodeTypeStep/.test(boardJs), 'props can persist a node font step');
  assert.ok(/same as global/.test(boardJs), 'unset node font hints same as global');
  assert.ok(/skipRender/.test(chrome), 'applyDiagramTheme can skip render');
  assert.ok(/joinDocument\(doc\.meta/.test(shell), 'wrap rejoins board meta');
}

console.log('ok board-style-theme');
