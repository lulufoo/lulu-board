import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Token = require('../../packages/board-core/style-token.js');
const Style = require('../../packages/drawer-app/src/core/style-line.js').default;

function b64(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

{
  const token = b64({ palette: 'pastel' });
  const body = 'boxes "Demo"\nitem X type text "Hi"\n';
  assert.strictEqual(Style.joinRendererStyle(token, body), `style ${token}\n` + body);
  assert.strictEqual(Style.splitRendererStyle(`style ${token}\n` + body).token, token);
}

{
  const src = 'boxes "Demo"\n';
  const split = Style.splitRendererStyle(src);
  assert.strictEqual(split.token, '');
  assert.strictEqual(split.body, src);
}

{
  assert.strictEqual(Style.isRendererStyleLine('style eyJ0aGVtZSI6ImthbWkifQ=='), true);
  assert.strictEqual(Style.isRendererStyleLine('%% style classic'), true);
  assert.strictEqual(Style.isRendererStyleLine('style A fill:#f9f'), false);
  assert.strictEqual(Style.bodyIsBoard('board "Demo"\nstyle xxx\n'), false);
  assert.strictEqual(Style.bodyIsBoard('boxes "Demo"\nstyle xxx\n'), true);
}

{
  const flow = 'flowchart TD\nA-->B\n';
  assert.strictEqual(Style.joinRendererStyle('classic', flow), '%% style classic\n' + flow);
  assert.strictEqual(Style.splitRendererStyle('%% style classic\n' + flow).token, 'classic');
  assert.strictEqual(Style.splitRendererStyle('%% style classic\n' + flow).body, flow);
  assert.strictEqual(Style.joinRendererStyle('classic', 'boxes "A"\n'), 'style classic\nboxes "A"\n');
  assert.strictEqual(Style.mermaidStyleToken('classic'), '');
  assert.strictEqual(Style.mermaidStyleToken('default'), '');
  assert.strictEqual(Style.mermaidStyleToken('dark'), '');
  assert.strictEqual(Style.appearanceFromStyleToken('pastel'), 'light');
  assert.strictEqual(Style.appearanceFromStyleToken('kami'), 'light');
  assert.strictEqual(Style.appearanceFromStyleToken(b64({ theme: 'pastel' })), 'light');
  assert.strictEqual(Style.appearanceFromStyleToken(b64({ color: 'classic' })), 'light');
  assert.strictEqual(Style.appearanceFromStyleToken(b64({ appearance: 'dark' })), 'light');
  assert.strictEqual(Style.paletteFromStyleToken('pastel'), 'default');
  assert.strictEqual(Style.mermaidStyleToken('classic', 0), '');
  assert.strictEqual(Style.mermaidStyleToken('default', 0), '');
  assert.strictEqual(Style.typeStepFromStyleToken('classic'), 0);
  assert.strictEqual(Style.typeStepFromStyleToken(''), 0);
  const stepped = Style.mermaidStyleToken('classic', 2);
  assert.strictEqual(stepped, b64({ font_size: 2 }));
  assert.strictEqual(Style.appearanceFromStyleToken(stepped), 'light');
  assert.strictEqual(Style.paletteFromStyleToken(stepped), 'default');
  assert.strictEqual(Style.typeStepFromStyleToken(stepped), 2);
  const defaultStepped = Style.mermaidStyleToken('default', -1);
  assert.ok(defaultStepped);
  assert.strictEqual(Style.paletteFromStyleToken(defaultStepped), 'default');
  assert.strictEqual(Style.typeStepFromStyleToken(defaultStepped), -1);
  const written = Style.joinRendererStyle(stepped, flow);
  assert.match(written, /^%% style /);
  const split = Style.splitRendererStyle(written);
  assert.strictEqual(Style.typeStepFromStyleToken(split.token), 2);
  assert.strictEqual(Style.appearanceFromStyleToken(split.token), 'light');
}

{
  assert.strictEqual(Style.bodyKind('board "Demo"\n'), 'unknown');
  assert.strictEqual(Style.bodyKind('boxes "Demo"\n'), 'boxes');
  assert.strictEqual(Style.bodyKind('sketch ""\n'), 'sketch');
  assert.strictEqual(Style.bodyKind('style eyJ0aGVtZSI6ImRlZmF1bHQifQ==\nsketch ""\ncontent e30=\n'), 'sketch');
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
  const Create = require('../../packages/drawer-app/src/chrome/create-kind-dialog.js');
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
  {
    const src = 'sketch ""\nstyle ' + b64({ viewport: { scale: 1, cx: 480, cy: 270 } }) + '\ncontent ' + Buffer.from('<style></style><div class="sketch-board"></div>', 'utf8').toString('base64') + '\n';
    assert.strictEqual(Style.bodyKind(src), 'sketch');
    assert.doesNotMatch(src, /(?:style|content)\s+\{/);
    assert.strictEqual(Style.decodeStyleTokenJson(Style.splitRendererStyle(src).token).viewport.cx, 480);
    assert.strictEqual(Style.decodeSketchContent(src), '<style></style><div class="sketch-board"></div>');
    assert.strictEqual(Style.bodyKindLabel('sketch\n'), 'Sketch');
  }
  assert.strictEqual(Style.bodyKindLabel(''), 'Source');
  assert.strictEqual(Style.bodyKindLabel('not a diagram\n'), 'Source');
}

{
  const drawerBuild = fs.readFileSync(path.join(__dirname, '../../scripts/build-app/drawer.mjs'), 'utf8');
  const tokenBuild = fs.readFileSync(path.join(__dirname, '../../scripts/build-app/style-token.mjs'), 'utf8');
  assert.match(drawerBuild, /bundleStyleToken/, 'drawer bundle loads the shared token');
  assert.match(tokenBuild, /board-core\/style-token\.js/, 'drawer build reads board-core');
  const boardSkill = fs.readFileSync(path.join(__dirname, '../../skills/boxes/SKILL.md'), 'utf8');
  const chrome = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/src/chrome/chrome-boot.js'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/src/state/shell-state.js'), 'utf8');
  assert.ok(/Mint without style/.test(boardSkill), 'board SKILL names stash rule');
  assert.ok(/persistBoardStyle/.test(chrome), 'font size and max width still persist board style');
  assert.doesNotMatch(chrome, /persistBoardStyle\(\{ appearance/, 'theme click does not write appearance into the document');
  assert.match(chrome, /setSessionAppearance/, 'theme click keeps appearance in session memory');
  assert.match(chrome, /applyGround\(document\.documentElement, t\)/, 'theme click paints the canvas ground');
  const boardJs = ['board.js', 'board-style.js', 'diagram.js'].map((f) => fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/src/kinds', f), 'utf8')).join('\n');
  assert.ok(/updateNodeTypeStep/.test(boardJs), 'props can persist a node font step');
  assert.ok(/same as global/.test(boardJs), 'unset node font hints same as global');
  assert.ok(/skipRender/.test(chrome), 'applyKindTheme can skip render');
  assert.ok(/stripDocumentMeta/.test(shell) && !/joinDocument/.test(shell), 'wrap strips leftover meta and does not rejoin');
  assert.ok(/typeStepFromStyleToken/.test(boardJs), 'mermaid style chrome reads font_size');
  assert.ok(/persistStyleToken\(styled\.token, patch/.test(boardJs), 'mermaid persist merges the current token with the patch');
  assert.strictEqual(
    Style.encodeStylePayload({ appearance: 'dark' }),
    Token.encodeStylePayload({ appearance: 'dark' }),
    'mermaid encode is the shared token',
  );
  assert.deepStrictEqual(
    Token.authoredFields({ appearance: 'dark', font_size: 0, max_width: 0 }),
    {},
    'shared fields omit appearance and defaults',
  );
  assert.deepStrictEqual(
    Token.authoredFields({ appearance: 'light', font_size: 2, max_width: 2 }),
    { font_size: 2, max_width: 2 },
    'shared fields keep non-default width and step',
  );
  assert.deepStrictEqual(
    Token.authoredFields({ theme: 'classic', color: 'pastel', background: 'dusk' }),
    {},
    'dead theme, color, and background keys are not authored',
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
    Token.encodeStylePayload(Token.authoredFields({ appearance: 'classic', font_size: 2 })),
    'mermaid token is shared authored fields',
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(
      Token.decodeStylePayload(Style.mermaidStyleToken('classic', 2)),
      'max_width',
    ),
    'flowchart still does not write max_width',
  );
  assert.ok(/patch\.appearance == null && patch\.font_size == null && !Object\.prototype\.hasOwnProperty\.call\(patch, "viewport"\)/.test(boardJs), 'flowchart persist accepts viewport without appearance');
  const withView = Style.mermaidStyleToken('classic', 2, { scale: 0.8, cx: 10, cy: 20 });
  assert.deepStrictEqual(Token.decodeStylePayload(withView), {
    font_size: 2,
    viewport: { scale: 0.8, cx: 10, cy: 20 },
  });
  assert.strictEqual(Style.mermaidStyleToken('default', 0, { scale: 1, cx: 0, cy: 0 }), '');
  assert.strictEqual(Style.persistStyleToken('', { background: 'dusk' }), '');
  assert.strictEqual(Style.persistStyleToken('', { theme: 'classic' }), '');
  assert.strictEqual(Style.persistStyleToken('', { color: 'pastel' }), '');
  assert.deepStrictEqual(
    Token.decodeStylePayload(Style.persistStyleToken('', { palette: 'classic' })),
    {},
  );
  assert.strictEqual(Style.persistStyleToken('', { palette: 'classic' }), '');
  assert.strictEqual(Style.persistStyleToken('', { appearance: 'dark' }), '');
  assert.strictEqual(
    Style.persistStyleToken(b64({ theme: 'pastel', background: 'dusk', color: 'classic', palette: 'classic' }), { appearance: 'dark' }),
    '',
    'write drops dead theme, color, background, palette, and appearance keys',
  );
  assert.deepStrictEqual(
    Token.decodeStylePayload(Style.persistStyleToken(b64({ appearance: 'dark', font_size: 2 }), { font_size: 2 })),
    { font_size: 2 },
    'write strips leftover appearance',
  );
  assert.ok(!Object.prototype.hasOwnProperty.call(Style.fieldsFromStyleToken(''), 'background'));
  const stale = Style.persistStyleToken(b64({ theme: 'pastel', type_step: 3 }), { palette: 'classic' });
  assert.deepStrictEqual(Token.decodeStylePayload(stale), {
    type_step: 3,
  });
  assert.strictEqual(Style.typeStepFromStyleToken(stale), 0);
  const sized = Style.persistStyleToken(stale, { font_size: 2 });
  assert.deepStrictEqual(Token.decodeStylePayload(sized), {
    font_size: 2,
    type_step: 3,
  });
  assert.strictEqual(Style.typeStepFromStyleToken(sized), 2);
}

console.log('ok board-style-theme');
