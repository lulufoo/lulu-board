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
  assert.strictEqual(Style.bodyIsBoard('boxes "Demo"\nstyle xxx\n'), true);
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
  assert.strictEqual(Style.bodyKind('board "Demo"\n'), 'boxes');
  assert.strictEqual(Style.bodyKind('boxes "Demo"\n'), 'boxes');
  assert.strictEqual(Style.bodyKind('flowchart TD\nA-->B\n'), 'flowchart');
  assert.strictEqual(Style.bodyKind('graph LR\nA-->B\n'), 'flowchart');
  assert.strictEqual(Style.bodyKind('%% title Demo\nflowchart TD\nA-->B\n'), 'flowchart');
  assert.strictEqual(Style.bodyKind('style default\nflowchart TD\nA-->B\n'), 'flowchart');
  assert.strictEqual(Style.bodyKind('mindmap\nroot((A))\n'), 'mindmap');
  assert.strictEqual(Style.bodyKind('sequenceDiagram\nA->>B: hi\n'), 'sequence');
  assert.strictEqual(Style.bodyKind('classDiagram\nclass A\n'), 'class');
  assert.strictEqual(Style.bodyKind('classDiagram-v2\n'), 'class');
  assert.strictEqual(Style.bodyKind('stateDiagram-v2\n[*] --> A\n'), 'state');
  assert.strictEqual(Style.bodyKind('erDiagram\nA ||--o{ B : has\n'), 'er');
  assert.strictEqual(Style.bodyKind('requirementDiagram\n'), 'requirement');
  assert.strictEqual(Style.bodyKind('C4Context\n'), 'c4');
  assert.strictEqual(Style.bodyKind('C4Container\n'), 'c4');
  assert.strictEqual(Style.bodyKind('usecase-beta\n'), 'usecase');
  assert.strictEqual(Style.bodyKind('eventmodeling\n'), 'eventmodeling');
  assert.strictEqual(Style.bodyKind('railroad-beta\n'), 'railroad');
  assert.strictEqual(Style.bodyKind('railroad-ebnf-beta\n'), 'railroad');
  assert.ok(Style.isDesignKind('sequence'));
  assert.ok(Style.isMermaidKind('sequence'));
  assert.ok(!Style.isDesignKind('gantt'));
  assert.strictEqual(Style.bodyKind('block\ncolumns 1\nA\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('xychart\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('sankey\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('packet\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('swimlane-beta\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('agentflow-beta\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('treeView-beta\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('cynefin-beta\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('wardley-beta\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('venn-beta\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('ishikawa\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind('treemap\n'), 'mermaid-unsupported');
  assert.strictEqual(Style.bodyKind(''), 'empty');
  assert.strictEqual(Style.bodyKind('not a diagram\n'), 'unknown');
  assert.strictEqual(Style.bodyKind('info\n'), 'unknown');
}

{
  const Create = require('../../packages/drawer-app/js/09-create-kind-dialog.js');
  Create.CREATE_KIND_ITEMS.filter((item) => item.kind !== 'welcome').forEach((item) => {
    const src = item.kind === 'boxes' ? 'boxes "X"\n' : item.kind + '\n';
    assert.strictEqual(Style.bodyKindLabel(src), item.name, item.kind);
  });
  assert.strictEqual(Style.bodyKindLabel('mindmap\nRoot\n'), 'Mindmap');
  assert.strictEqual(Style.bodyKindLabel('flowchart LR\nA-->B\n'), 'Flowchart');
  assert.strictEqual(Style.bodyKindLabel('graph TD\nA-->B\n'), 'Flowchart');
  assert.strictEqual(Style.bodyKindLabel('%% style classic\nflowchart TD\n'), 'Flowchart');
  assert.strictEqual(Style.bodyKindLabel('classDiagram-v2\n'), 'Class');
  assert.strictEqual(Style.bodyKindLabel('stateDiagram-v2\n'), 'State');
  assert.strictEqual(Style.bodyKindLabel('C4Container\n'), 'C4');
  assert.strictEqual(Style.bodyKindLabel('railroad-ebnf-beta\n'), 'Railroad');
  assert.strictEqual(Style.bodyKindLabel(''), 'Source');
  assert.strictEqual(Style.bodyKindLabel('not a diagram\n'), 'Source');
}

{
  const drawerBuild = fs.readFileSync(path.join(__dirname, '../../scripts/drawer-app-build/build.mjs'), 'utf8');
  const boardBuild = fs.readFileSync(path.join(__dirname, '../../scripts/board-build/build.mjs'), 'utf8');
  assert.match(drawerBuild, /board\/engine\/style-token\.js/, 'drawer bundle loads the shared token');
  assert.match(boardBuild, /engine\/style-token\.js/, 'board bundle loads the shared token');
  const boardSkill = fs.readFileSync(path.join(__dirname, '../../skill/boxes/SKILL.md'), 'utf8');
  const chrome = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/01-shell-state.js'), 'utf8');
  assert.ok(/Mint without style/.test(boardSkill), 'board SKILL names stash rule');
  assert.ok(/persistBoardStyle/.test(chrome), 'theme click can persist board style');
  const boardJs = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/02-board.js'), 'utf8');
  assert.ok(/updateNodeTypeStep/.test(boardJs), 'props can persist a node font step');
  assert.ok(/same as global/.test(boardJs), 'unset node font hints same as global');
  assert.ok(/skipRender/.test(chrome), 'applyKindTheme can skip render');
  assert.ok(/stripDocumentMeta/.test(shell) && !/joinDocument/.test(shell), 'wrap strips leftover meta and does not rejoin');
  assert.ok(/typeStepFromStyleToken/.test(boardJs), 'mermaid style chrome reads type_step');
  assert.ok(/mermaidStyleToken\(theme, step, viewport\)/.test(boardJs), 'mermaid persist writes theme, type_step, viewport');
  assert.strictEqual(
    Style.encodeStylePayload({ theme: 'classic' }),
    Token.encodeStylePayload({ theme: 'classic' }),
    'mermaid encode is the shared token',
  );
  assert.deepStrictEqual(
    Token.authoredFields({ theme: 'classic', type_step: 0, item_cap: 16 }),
    { theme: 'classic' },
    'shared fields omit defaults',
  );
  assert.deepStrictEqual(
    Token.authoredFields({ theme: 'default', type_step: 2, item_cap: 20 }),
    { type_step: 2, item_cap: 20 },
    'shared fields keep non-default cap and step',
  );
  assert.deepStrictEqual(
    Token.authoredFields({ viewport: { scale: 1, cx: 0, cy: 0 } }),
    {},
    'shared fields omit the default camera',
  );
  assert.deepStrictEqual(
    Token.authoredFields({ viewport: { scale: 0.8, cx: 12, cy: 24 } }),
    { viewport: { scale: 0.8, cx: 12, cy: 24 } },
    'shared fields keep a moved camera',
  );
  assert.deepStrictEqual(Token.resolveFields({}), Token.DEFAULTS);
  assert.deepStrictEqual(Token.resolveFields({}).viewport, { scale: 1, cx: 0, cy: 0 });
  assert.strictEqual(
    Style.mermaidStyleToken('classic', 2),
    Token.encodeStylePayload(Token.authoredFields({ theme: 'classic', type_step: 2 })),
    'mermaid token is shared authored fields',
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(
      Token.decodeStylePayload(Style.mermaidStyleToken('classic', 2)),
      'item_cap',
    ),
    'flowchart still does not write item_cap',
  );
  assert.ok(/patch\.theme == null && patch\.type_step == null && !Object\.prototype\.hasOwnProperty\.call\(patch, "viewport"\)/.test(boardJs), 'flowchart persist accepts viewport without theme');
  const withView = Style.mermaidStyleToken('classic', 2, { scale: 0.8, cx: 10, cy: 20 });
  assert.deepStrictEqual(Token.decodeStylePayload(withView), {
    theme: 'classic',
    type_step: 2,
    viewport: { scale: 0.8, cx: 10, cy: 20 },
  });
  assert.strictEqual(Style.mermaidStyleToken('default', 0, { scale: 1, cx: 0, cy: 0 }), '');
}

console.log('ok board-style-theme');
