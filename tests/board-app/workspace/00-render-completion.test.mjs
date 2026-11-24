import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import DrawerStyleLine from '../../../packages/board-app/workspace/src/core/style-line.js';
import { stripDocumentMeta } from '../../../packages/board-app/workspace/src/core/document-meta.js';
import { createPageRevision } from '../../../packages/board-app/workspace/src/core/page-revision.js';
import * as Protocol from '../../../packages/sandbox-app/src/protocol.js';
import { openSketchChannel, getSketchChannel, settleSketchPick, failSketchPicks } from '../../../packages/board-app/workspace/src/kinds/sketch-bridge.js';

const root = new URL('../../../', import.meta.url);
const read = rel => fs.readFileSync(new URL('packages/board-app/workspace/src/kinds/' + rel, root), 'utf8');
const diagram = read('diagram.js');
const sketch = read('sketch.js');
function productionFunction(source, name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, name);
  const start = match.index;
  const tail = source.slice(start + match[0].length);
  const next = /\n(?:(?:export )?(?:async )?function |export )/.exec(tail);
  assert.ok(next, name + ' ends before another declaration');
  return source.slice(start, start + match[0].length + next.index);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));

function page(source = 'boxes "Example"\n') {
  const revision = createPageRevision();
  const messages = new Set();
  const timers = new Map();
  const frames = [];
  const errors = [];
  const cameras = [];
  let nextTimer = 0;
  function element(name = 'div') {
    const classes = new Set();
    const el = {
      tagName: name.toUpperCase(), children: [], parentNode: null, style: {}, dataset: {},
      _connected: false, offsetWidth: 960, offsetHeight: 540,
      classList: { add(...all) { all.forEach(value => classes.add(value)); }, remove(value) { classes.delete(value); }, contains(value) { return classes.has(value); } },
      setAttribute() {}, getAttribute(key) { return key === 'viewBox' ? '0 0 960 540' : '960'; },
      appendChild(child) { child.parentNode = el; el.children.push(child); return child; },
      querySelector(selector) { return selector === 'svg' && el._html?.includes('<svg') ? svg : null; },
      querySelectorAll() { return []; },
    };
    Object.defineProperty(el, 'isConnected', { get() { return el.parentNode ? el.parentNode.isConnected : el._connected; } });
    Object.defineProperty(el, 'childElementCount', { get() { return el.children.length; } });
    Object.defineProperty(el, 'innerHTML', {
      get() { return el._html || ''; },
      set(value) { el.children.forEach(child => { child.parentNode = null; child._connected = false; }); el.children = []; el._html = value; },
    });
    if (name === 'iframe') {
      el.contentWindow = { posted: [], postMessage(data) { this.posted.push(data); } };
      frames.push(el);
    }
    return el;
  }
  const svg = element('svg');
  const preview = element();
  preview._connected = true;
  const editor = { value: source, dataset: {} };
  const html = { dataset: {}, removeAttribute() {} };
  const boxRoot = element();
  boxRoot._connected = true;
  boxRoot.classList.add('board-canvas');
  const context = {
    console, Promise, Error, Object, String, Number, Array, Map, isFinite,
    document: { documentElement: html, createElement: element, getElementById() { return null; } },
    window: {
      pele: { render: () => ({ svg: '<svg></svg>' }) },
      addEventListener(type, listener) { if (type === 'message') messages.add(listener); },
      removeEventListener(type, listener) { if (type === 'message') messages.delete(listener); },
    },
    diagramSourceEl: editor, previewEl: preview,
    BoxesRender: { render: () => Promise.resolve({ root: boxRoot, board: {}, frames: new Map() }) },
    MindmapEdit: { render: () => ({ svg: '<svg></svg>' }) },
    DrawerStyleLine, stripDocumentMeta,
    observeDiagramSource() { revision.observe(editor.value); }, getPageRevision() { return revision.get(); },
    applyDrawerKind() {}, updateDiagramChars() {},
    applyDocumentGround() {}, pinDiagramTitle() {},
    applyTransform() { cameras.push('transform'); }, fitDiagramView() { cameras.push('fit'); },
    applyRestoredDiagramView() { cameras.push('restore'); },
    getSessionAppearance() { return 'light'; }, currentMindmapLayout() { return 'radial'; },
    restoreMindmapSelection() {}, fillMindmapProps() {}, applyMindmapSelectionVisual() {},
    restoreFlowchartSelection() {}, fillDesignProps() {},
    FlowchartShapes: null, FlowchartTypeScale: null, DrawerPeleTheme: null,
    showDiagramError(message) { if (message) errors.push(message); }, setStatus() {},
    emit(name, ...args) { if (name === 'finishCanvasView') return context.finishCanvasView(...args); },
    call(name) { if (name === 'placeDocumentCamera') return true; return null; },
    requestAnimationFrame(listener) { listener(); },
    setTimeout(listener, delay) { const id = ++nextTimer; timers.set(id, { listener, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    sketchMountHtml(fragment) { return fragment; }, setSketchMode() {}, getSessionSketchMode() { return 'edit'; },
    ...Protocol, openSketchChannel, settleSketchPick, failSketchPicks,
  };
  vm.createContext(context);
  const diagramFunctions = [
    'clearDrawerBoot', 'holdDiagramSwap', 'releaseDiagramSwap', 'sourceBodyForKind',
    'bindCanvasWorld', 'canvasSvgBounds', 'fixSvgIntrinsic', 'finishCanvasView',
    'syncMermaidStyleChrome', 'isDesignKind', 'paintPeleSvg', 'renderFlowchart',
    'renderDesignPele', 'refuseUnsupportedMermaid', 'renderMindmap', 'renderDiagram',
  ].map(name => productionFunction(diagram, name));
  const sketchFunctions = ['sketchWorldBounds', 'bindWorld', 'renderSketch'].map(name => productionFunction(sketch, name));
  vm.runInContext([
    'var diagramSwapSeq = 0, diagramRenderToken = 0, pendingDiagramRender = null;',
    'var liveDiagramId = "b_aabbccdd", PELE_VIEW_SCALE = 1.5, PELE_FONT_STACK = "sans-serif";',
    'var RUNNER_TIMEOUT_MS = 10000, SKETCH_RUNNER_URL = "https://sandbox.luluboard.app/", stopListening = null, mountedSketch = null;',
    ...diagramFunctions, ...sketchFunctions,
  ].join('\n'), context);
  return {
    context, editor, preview, frames, errors, cameras, boxRoot,
    render(opts) { return context.renderDiagram(opts); },
    change(value) { editor.value = value; revision.observe(value); },
    invalidate() { revision.invalidate(); },
    frame() { return frames[frames.length - 1]; },
    send(frame, data, origin = 'null') { [...messages].forEach(listener => listener({ source: frame.contentWindow, origin, data })); },
    timeout() { [...timers.entries()].filter(([, entry]) => entry.delay === 10000).forEach(([id, entry]) => { timers.delete(id); entry.listener(); }); },
  };
}

{
  const p = page();
  const drawing = deferred();
  p.context.BoxesRender.render = () => drawing.promise;
  let settled = false;
  const result = p.render({ restoreView: true }).then(value => { settled = true; return value; });
  await tick();
  assert.equal(settled, false, 'Boxes waits for the engine render promise');
  drawing.resolve({ root: p.boxRoot, board: {} });
  assert.deepEqual(plain(await result), { ok: true });
  assert.deepEqual(p.cameras, ['restore'], 'completion follows the existing view placement');
}

{
  const p = page();
  p.context.BoxesRender.render = () => Promise.reject(new Error('Boxes failed'));
  const unhandled = [];
  const listener = reason => unhandled.push(reason);
  process.on('unhandledRejection', listener);
  try {
    p.render(); // Existing UI callers intentionally ignore the completion result.
    await tick();
    assert.deepEqual(unhandled, [], 'ignored render failures never reject');
    assert.match(p.errors[0], /Boxes failed/);
    assert.equal((await p.render()).ok, false);
    p.context.BoxesRender.render = () => { throw new Error('Synchronous engine failure'); };
    assert.equal((await p.render()).code, 'RENDER_FAILED');
  } finally { process.off('unhandledRejection', listener); }
}

{
  for (const kind of ['flowchart TD\nA --> B\n', 'sequenceDiagram\nA->>B: Hi\n', 'mindmap\n  Root\n']) {
    const p = page(kind);
    assert.deepEqual(plain(await p.render()), { ok: true });
    if (kind.startsWith('mindmap')) p.context.MindmapEdit.render = () => ({ errors: ['Mindmap failed'] });
    else p.context.window.pele.render = () => { throw new Error('Pele failed'); };
    const failure = await p.render();
    assert.equal(failure.ok, false);
    assert.equal(failure.code, 'RENDER_FAILED');
    assert.match(failure.message, /failed/);
  }
  assert.equal((await page('gantt\n').render()).ok, false);
  assert.equal((await page('').render()).ok, false);
  const p = page('flowchart TD\n'); p.context.window.pele = null;
  assert.equal((await p.render()).code, 'RENDER_FAILED', 'missing engine is not success');
  const partial = page('mindmap\n  First\n  Second\n');
  partial.context.MindmapEdit.render = () => ({ svg: '<svg></svg>', errors: ['Multiple roots'] });
  assert.equal((await partial.render()).ok, false, 'a partial mindmap drawing does not turn parser diagnostics into success');
}

{
  for (const change of [p => p.change('boxes "Changed"\n'), p => { p.context.liveDiagramId = 'b_11223344'; }, p => p.invalidate()]) {
    const p = page(); const drawing = deferred();
    p.context.BoxesRender.render = () => drawing.promise;
    const pending = p.render(); change(p);
    drawing.resolve({ root: p.boxRoot, board: {} });
    assert.equal((await pending).superseded, true, 'Source, loaded ID, or page generation changes supersede a render');
  }
  const p = page(); const first = deferred(), second = deferred(); let renders = 0;
  p.context.BoxesRender.render = () => (++renders === 1 ? first.promise : second.promise);
  const before = p.render(); const after = p.render();
  assert.equal((await before).superseded, true, 'a newer render settles the previous promise immediately');
  first.resolve({ root: p.boxRoot, board: {} }); second.resolve({ root: p.boxRoot, board: {} });
  assert.equal((await after).ok, true);
}

const sketchSource = 'sketch "Example"\ncontent ' + Buffer.from('<div>Example</div>').toString('base64') + '\n';
{
  const p = page(sketchSource); let settled = false;
  const pending = p.render().then(value => { settled = true; return value; });
  const frame = p.frame();
  p.send(frame, Protocol.readyMessage()); await tick();
  assert.equal(settled, false, 'runner ready is not a rendered size');
  assert.equal(frame.contentWindow.posted[0].type, Protocol.SANDBOX_MSG.RENDER);
  p.send(frame, Protocol.sizeMessage(960, 540, 12));
  assert.equal((await pending).ok, true);
  assert.equal(frame.parentNode.style.opacity, '1');
  const frameCount = p.frames.length;
  assert.equal((await p.render()).ok, true, 'a fully sized existing frame may be reused');
  assert.equal(p.frames.length, frameCount);
  p.invalidate();
  p.change(sketchSource + '# in-place text edit\n');
  const channel = getSketchChannel(frame);
  let picked, captured;
  channel.picks.set('pick-review', { timer: 0, resolve(value) { picked = value; } });
  channel.pending.set('capture-review', { timer: 0, resolve(value) { captured = value; }, reject() { throw new Error('capture must survive a later page revision'); } });
  p.send(frame, Protocol.sizeMessage(1000, 600));
  p.send(frame, Protocol.pickedMessage('pick-review', '0'));
  const bitmap = { width: 1000, height: 600 };
  p.send(frame, Protocol.capturedMessage('capture-review', bitmap));
  assert.equal(frame.style.width, '1000px', 'a completed frame continues reporting size after page revisions');
  assert.equal(picked, '0', 'the real channel still resolves picks after an in-place edit');
  assert.equal(captured, bitmap, 'the real channel still resolves captures after save/readiness revisions');
}

{
  const p = page(sketchSource); const pending = p.render();
  p.timeout();
  const result = await pending;
  assert.equal(result.ok, false); assert.match(result.message, /did not respond/);
  const failed = page(sketchSource); const mount = failed.render();
  failed.send(failed.frame(), Protocol.errorMessage(null, 'Runner render failed'));
  assert.match((await mount).message, /Runner render failed/);
  const detached = page(sketchSource); const old = detached.render();
  detached.preview.innerHTML = ''; detached.timeout();
  assert.equal((await old).superseded, true, 'a removed frame cannot leave a completion hanging');
}

{
  const p = page(sketchSource); const before = p.render();
  p.send(p.frame(), Protocol.readyMessage());
  const after = p.render();
  assert.equal((await before).superseded, true);
  assert.equal(p.frames.length, 2, 'ready without a size cannot take the mounted-frame success shortcut');
  p.send(p.frame(), Protocol.readyMessage()); p.send(p.frame(), Protocol.sizeMessage(960, 540));
  assert.equal((await after).ok, true);
  const changed = page(sketchSource); const pending = changed.render();
  changed.change(sketchSource + '# changed\n'); changed.send(changed.frame(), Protocol.sizeMessage(960, 540));
  assert.equal((await pending).superseded, true, 'a stale runner size does not confirm a newer Source');
}

console.log('ok renderer completion, failures, supersession, and Sketch runner lifecycle');
