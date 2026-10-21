'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Token = require('../../packages/board/engine/style-token.js');
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
  assert.strictEqual(Style.isRendererStyleLine('%% style classic'), true);
  assert.strictEqual(Style.isRendererStyleLine('style A fill:#f9f'), false);
  assert.strictEqual(Style.bodyIsBoard('board "Demo"\nstyle xxx\n'), true);
}

{
  const flow = 'flowchart TD\nA-->B\n';
  assert.strictEqual(Style.joinRendererStyle('classic', flow), '%% style classic\n' + flow);
  assert.strictEqual(Style.splitRendererStyle('%% style classic\n' + flow).token, 'classic');
  assert.strictEqual(Style.splitRendererStyle('%% style classic\n' + flow).body, flow);
  assert.strictEqual(Style.joinRendererStyle('classic', 'board "A"\n'), 'style classic\nboard "A"\n');
  assert.strictEqual(Style.mermaidStyleToken('classic'), Token.encodeStylePayload({ theme: 'classic' }));
  assert.strictEqual(Style.mermaidStyleToken('classic'), b64({ theme: 'classic' }));
  assert.strictEqual(Style.mermaidStyleToken('default'), '');
  assert.strictEqual(Style.themeFromStyleToken('pastel'), 'pastel');
  assert.strictEqual(Style.themeFromStyleToken('kami'), 'default');
  assert.strictEqual(Style.mermaidStyleToken('classic', 0), b64({ theme: 'classic' }));
  assert.strictEqual(Style.mermaidStyleToken('default', 0), '');
  assert.strictEqual(Style.typeStepFromStyleToken('classic'), 0);
  assert.strictEqual(Style.typeStepFromStyleToken(''), 0);
  const stepped = Style.mermaidStyleToken('classic', 2);
  assert.strictEqual(stepped, b64({ theme: 'classic', type_step: 2 }));
  assert.strictEqual(Style.themeFromStyleToken(stepped), 'classic');
  assert.strictEqual(Style.typeStepFromStyleToken(stepped), 2);
  const defaultStepped = Style.mermaidStyleToken('default', -1);
  assert.ok(defaultStepped);
  assert.strictEqual(Style.themeFromStyleToken(defaultStepped), 'default');
  assert.strictEqual(Style.typeStepFromStyleToken(defaultStepped), -1);
  const written = Style.joinRendererStyle(stepped, flow);
  assert.match(written, /^%% style /);
  const split = Style.splitRendererStyle(written);
  assert.strictEqual(Style.typeStepFromStyleToken(split.token), 2);
  assert.strictEqual(Style.themeFromStyleToken(split.token), 'classic');
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
  const drawerBuild = fs.readFileSync(path.join(__dirname, '../../scripts/drawer-app-build/build.mjs'), 'utf8');
  const boardBuild = fs.readFileSync(path.join(__dirname, '../../scripts/board-build/build.mjs'), 'utf8');
  assert.match(drawerBuild, /board\/engine\/style-token\.js/, 'drawer bundle loads the shared token');
  assert.match(boardBuild, /engine\/style-token\.js/, 'board bundle loads the shared token');
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
  assert.ok(/typeStepFromStyleToken/.test(boardJs), 'mermaid style chrome reads type_step');
  assert.ok(/mermaidStyleToken\(theme, step\)/.test(boardJs), 'mermaid persist writes theme plus type_step');
  assert.strictEqual(
    Style.encodeStylePayload({ theme: 'classic' }),
    Token.encodeStylePayload({ theme: 'classic' }),
    'mermaid encode is the shared token',
  );
  assert.ok(/patch\.theme == null && patch\.type_step == null/.test(boardJs), 'flowchart persist accepts type_step without theme');
}

console.log('ok board-style-theme');
