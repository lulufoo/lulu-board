import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../../..');
const Interaction = require('../../../packages/board-app/workspace/src/state/canvas-interaction.js').default;

assert.ok(Interaction.wheelFactor(0, 0) === 1, 'zero wheel keeps scale');
assert.ok(Interaction.wheelFactor(100, 0) < 1, 'scroll down zooms out');
assert.ok(Interaction.wheelFactor(-100, 0) > 1, 'scroll up zooms in');

assert.ok(Interaction.isBlockedTarget({ closest: (sel) => sel.indexOf('.diagram-dock') >= 0 }), 'chrome is blocked');
assert.ok(!Interaction.isBlockedTarget({ closest: () => null }), 'blank stage is not a hit');
assert.ok(!Interaction.isBlockedTarget(null), 'missing target is blank');

assert.ok(Interaction.isSketchPresent({ documentElement: { dataset: { kind: 'sketch', sketchMode: 'present' } } }), 'Sketch Present locks the host ground');
assert.ok(!Interaction.isSketchPresent({ documentElement: { dataset: { kind: 'sketch', sketchMode: 'canvas' } } }), 'Sketch Canvas does not lock the ground');
assert.ok(!Interaction.isSketchPresent({ documentElement: { dataset: { kind: 'flowchart', sketchMode: 'present' } } }), 'Present on another kind does not lock');
assert.ok(!Interaction.isSketchPresent({ documentElement: { dataset: {} } }), 'an empty root is not Present');
assert.ok(!Interaction.isSketchPresent(null), 'a missing document is not Present');

let boardClear = 0;
let flowClear = 0;
Interaction.registerKind('board', {
  isHit: (t) => !!(t && t.kind === 'board-item'),
  clear: function () { boardClear += 1; },
});
Interaction.registerKind('flowchart', {
  isHit: (t) => !!(t && t.kind === 'pele-node'),
  clear: function () { flowClear += 1; },
});
assert.ok(!Interaction.isBlockedTarget({ kind: 'pele-node', closest: () => null }), 'inactive flowchart hit does not steal Design / Board pan');
assert.ok(!Interaction.isBlockedTarget({ closest: () => null }), 'blank is still not a hit');
Interaction.leaveBlank();
assert.strictEqual(boardClear, 1, 'default kind is board');
assert.strictEqual(flowClear, 0, 'inactive kind does not clear');

const build = fs.readFileSync(path.join(__dirname, '../../../scripts/build-app/drawer.mjs'), 'utf8');
const boot = fs.readFileSync(path.join(__dirname, '../../../packages/board-app/workspace/src/chrome/chrome-boot.js'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, '../../../packages/board-app/workspace/src/state/canvas-interaction.js'), 'utf8');
assert.ok(fs.existsSync(path.join(root, 'packages/board-app/workspace/src/state/canvas-interaction.js')), 'module is in the drawer bundle');
assert.doesNotMatch(boot, /CanvasInteraction\.setOnBlank/, 'chrome-boot does not pick the kind clear');
assert.doesNotMatch(boot, /clearFlowchartInteraction|clearBoardSelection/, 'chrome-boot has no kind blank path');
assert.doesNotMatch(boot, /stageEl\.addEventListener\('wheel'/, 'chrome-boot does not own wheel zoom');
assert.doesNotMatch(boot, /stageEl\.addEventListener\('pointerdown'/, 'chrome-boot does not own blank pan');
assert.match(src, /setCanvasZoom\(scale \* factor\)/, 'wheel still uses the live camera');
assert.match(src, /setCameraPan\(event\.clientX - panOrigin\.x, event\.clientY - panOrigin\.y\)/, 'pan still writes panX / panY');
const downAt = src.indexOf('function onPointerDown');
const moveAt = src.indexOf('function onPointerMove');
const endAt = src.indexOf('function endPan');
assert.ok(downAt >= 0 && moveAt > downAt && endAt >= 0);
assert.doesNotMatch(src.slice(downAt, moveAt), /leaveBlank|hideBlankProps|closePropsPanel/, 'pan start does not hide Properties');
assert.match(src.slice(endAt), /!moved && leaveIfStill\) leaveBlank/, 'blank click without move still leaves');
assert.match(src, /function hideBlankProps/, 'hide is on the shared canvas module');
assert.match(src, /\.diagram-dock-resize/, 'dock resize is chrome, not a blank leave');
assert.doesNotMatch(src, /let scale|var scale =|function applyTransform/, 'no second camera stack');
assert.match(src, /addEventListener\("dblclick", onDblClick\)/, 'blank dblclick is on the shared module');
assert.match(src, /openBlankProps/, 'blank dblclick opens Props');
const downFn = src.slice(src.indexOf('function onPointerDown'), src.indexOf('function onPointerMove'));
const presentAt = downFn.indexOf('if (isSketchPresent())');
const panAt = downFn.indexOf('panning = true');
const armed = downFn.indexOf('presentDismiss = true');
const presentReturn = downFn.indexOf('return;', armed);
assert.ok(presentAt >= 0 && armed > presentAt && presentReturn > armed && presentReturn < panAt, 'Present press returns before pan starts');
const wheelFn = src.slice(src.indexOf('function onWheel'), src.indexOf('function onPointerDown'));
assert.match(wheelFn, /if \(isSketchPresent\(\)\)/, 'Present wheel takes its own path, not wheel zoom');
assert.ok(wheelFn.indexOf('isSketchPresent') < wheelFn.indexOf('setCanvasZoom'), 'Present returns before the ground zooms');
assert.match(wheelFn, /presentWheel\(event\)/, 'the Present ground wheel feeds the one Present entry');
assert.match(src.slice(src.indexOf('function onDblClick'), src.indexOf('function onWheel')), /if \(isSketchPresent\(\)\) return;/, 'Present does not open Props on blank dblclick');
const upFn = src.slice(src.indexOf('function onPointerUp'), src.indexOf('function onPointerCancel'));
assert.match(upFn, /if \(presentDismiss\)/, 'Present click is handled on release');
assert.match(upFn, /leaveBlank\(\)/, 'Present blank click closes the dock');
assert.match(src.slice(src.indexOf('function onPointerCancel'), src.indexOf('function onSelectStart')), /presentDismiss = false/, 'a cancelled Present press does not stay armed');
assert.doesNotMatch(src, /from '\.\/.*sketch-mode/, 'the ground lock reads the live html attributes');
assert.strictEqual(typeof Interaction.openBlankProps, 'function', 'blank dblclick opens Props');
Interaction.openBlankProps();

const board = fs.readFileSync(path.join(__dirname, '../../../packages/board-app/workspace/src/kinds/board.js'), 'utf8');
const flow = fs.readFileSync(path.join(__dirname, '../../../packages/board-app/workspace/src/kinds/flowchart.js'), 'utf8');
const mind = fs.readFileSync(path.join(__dirname, '../../../packages/board-app/workspace/src/kinds/mindmap-select.js'), 'utf8');
assert.match(board, /registerKind\("board"/, 'Board registers hit / clear');
assert.match(mind, /registerKind\("mindmap"/, 'mindmap registers hit / clear');
const design = fs.readFileSync(path.join(__dirname, '../../../packages/board-app/workspace/src/kinds/design.js'), 'utf8');
assert.match(src, /kinds\[activeKindId\(\)\]/, 'pan hit uses the live kind only');
assert.match(design, /registerKind\("design"/, 'Design registers so Pele boxes do not block pan');
assert.match(flow, /if \(!isFlowchartKind\(\)\) return false/, 'flowchart hit stays on flowchart');
assert.doesNotMatch(mind, /closePropsPanel/, 'mindmap clear does not hide Properties');
assert.doesNotMatch(board, /previewEl\.addEventListener\("pointerdown"/, 'Board blank pointerdown is not a second path');
assert.doesNotMatch(flow, /else clearFlowchartInteraction\(\)/, 'flowchart miss is not a second blank path');
assert.match(board, /if \(!hit \|\| !canvas\.contains\(hit\)\) return;/, 'Board blank dblclick does not open Props');
assert.match(flow, /previewEl\.addEventListener\("dblclick"/, 'flowchart hit dblclick inspects');
assert.doesNotMatch(flow, /openBlankProps/, 'flowchart does not own blank props');
assert.doesNotMatch(flow, /closePropsPanel/, 'flowchart clear does not hide Properties');
assert.doesNotMatch(board, /closePropsPanel/, 'Board clear does not hide Properties');
assert.doesNotMatch(flow, /\.top-float, \.diagram-dock, \.zoom-float/, 'dock resize is not a flowchart leave');

{
  const previousDocument = globalThis.document;
  const blank = { closest() { return null; } };
  const chrome = { closest() { return true; } };
  let prevented = 0;
  let captured = 0;
  const classes = new Set();
  const stage = {
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
    },
    setPointerCapture() { captured += 1; },
    addEventListener(type, fn) { this.on[type] = fn; },
    on: {},
  };
  function press(target) {
    prevented = 0;
    stage.on.pointerdown({
      button: 0,
      target,
      clientX: 4,
      clientY: 5,
      pointerId: 1,
      preventDefault() { prevented += 1; },
    });
  }
  // Sketch is its own kind: Present and Canvas both clear through it, and Canvas lets it probe the click first.
  let sketchClear = 0;
  const probes = [];
  let probeTakesClick = false;
  Interaction.registerKind('sketch', {
    clear() { sketchClear += 1; },
    probe(x, y) { probes.push([x, y]); return probeTakesClick; },
  });
  Interaction.bind(stage);
  try {
    globalThis.document = { documentElement: { dataset: { kind: 'sketch', sketchMode: 'present' } } };
    assert.equal(Interaction.activeKindId(), 'sketch', 'a Sketch is its own kind, not the Boxes one');
    const base = sketchClear;
    const boardBase = boardClear;
    press(blank);
    assert.equal(prevented, 0, 'Present blank press does not pan');
    assert.equal(captured, 0, 'Present blank press does not capture the pointer');
    assert.equal(classes.has('panning'), false, 'Present blank press does not mark panning');
    assert.equal(sketchClear, base, 'Present press waits for release');
    stage.on.pointercancel({});
    stage.on.pointerup({});
    assert.equal(sketchClear, base, 'a cancelled Present press does not close the dock');
    press(blank);
    stage.on.pointerup({ clientX: 4, clientY: 5 });
    assert.equal(sketchClear, base + 1, 'Present blank click runs the same leave as Canvas');
    assert.equal(probes.length, 0, 'Present never probes: the picture takes its own clicks');
    stage.on.dblclick({ target: blank });
    assert.equal(sketchClear, base + 1, 'Present blank dblclick does not leave again');
    press(chrome);
    stage.on.pointerup({});
    assert.equal(sketchClear, base + 1, 'a click on chrome does not close the dock');
    globalThis.document = { documentElement: { dataset: { kind: 'sketch', sketchMode: 'canvas' } } };
    press(blank);
    assert.equal(prevented, 1, 'Canvas blank press still pans');
    assert.equal(captured, 1, 'Canvas blank press still captures the pointer');
    assert.equal(classes.has('panning'), true, 'Canvas blank press marks panning');
    stage.on.pointerup({ clientX: 4, clientY: 5 });
    assert.deepEqual(probes, [[4, 5]], 'a Canvas click that moved nothing is probed at its point');
    assert.equal(sketchClear, base + 2, 'a probe that declines leaves as before');
    assert.equal(classes.has('panning'), false, 'Canvas release clears panning');
    probeTakesClick = true;
    press(blank);
    stage.on.pointerup({ clientX: 4, clientY: 5 });
    assert.equal(probes.length, 2);
    assert.equal(sketchClear, base + 2, 'a probe that takes the click decides it later, so nothing leaves now');
    probeTakesClick = false;
    press(blank);
    stage.on.pointermove({ clientX: 40, clientY: 40 });
    stage.on.pointerup({ clientX: 40, clientY: 40 });
    assert.equal(sketchClear, base + 2, 'a Canvas drag does not leave');
    assert.equal(probes.length, 2, 'a Canvas drag is not probed');
    assert.equal(boardClear, boardBase, 'a Sketch never reaches the Boxes clear');
    Interaction.leaveBlank();
    assert.equal(probes.length, 2, 'leaving without a click never probes');
    assert.equal(sketchClear, base + 3);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

{
  // Present vertical scroll: one camera mover for the host ground and the runner's leftover swipe, clamped to
  // the content, with the quiet edge scrollbar as its only trace.
  const hooks = require('../../../packages/board-app/workspace/src/core/hooks.js');
  const previousDocument = globalThis.document;
  const camera = { scale: 0.5, cx: 300, cy: 1000 };
  const bounds = { minX: 0, minY: 0, maxX: 600, maxY: 2000, width: 600, height: 2000, cx: 300, cy: 1000 };
  const stageBox = { w: 400, h: 500 };
  let applied = null;
  hooks.register("readCamera", () => camera);
  hooks.register("contentBounds", () => bounds);
  hooks.register("stageSize", () => stageBox);
  hooks.register("applyCamera", (cam) => {
    applied = cam;
    camera.scale = cam.scale;
    camera.cx = cam.cx;
    camera.cy = cam.cy;
    return true;
  });
  function fakeEl(name) {
    const el = {
      name, className: '', style: {}, kids: [], firstChild: null, classes: [],
      appendChild(k) { el.kids.push(k); if (!el.firstChild) el.firstChild = k; },
      classList: {
        add(c) { el.classes.push(c); },
        remove(c) { el.classes = el.classes.filter((x) => x !== c); },
      },
    };
    return el;
  }
  const created = [];
  globalThis.document = {
    documentElement: { dataset: { kind: 'sketch', sketchMode: 'present' } },
    createElement(name) { const el = fakeEl(name); created.push(el); return el; },
  };
  const kids = [];
  const stage = {
    on: {},
    addEventListener(type, fn) { this.on[type] = fn; },
    appendChild(k) { kids.push(k); },
  };
  Interaction.bind(stage);
  try {
    // Half the stage in world is 250 / .5 = 500, so over 0..2000 content the centre runs 500..1500.
    assert.equal(Interaction.presentScrollBy(-200), true, 'a swipe up moves the camera while the picture is taller');
    assert.equal(camera.cy, 600, 'the move is the delta at the live zoom (200 / .5 = 400 world)');
    assert.equal(applied.scale, 0.5, 'Present scroll never touches the zoom');
    assert.equal(Interaction.presentScrollBy(-5000), true, 'a long swipe past the top is taken');
    assert.equal(camera.cy, 500, 'the camera stops with the content top at the stage top');
    assert.equal(Interaction.presentScrollBy(-10), false, 'at the top boundary nothing moves');
    assert.equal(Interaction.presentScrollBy(7000), true, 'a long swipe down reaches the bottom boundary');
    assert.equal(camera.cy, 1500, 'the camera stops with the content bottom at the stage bottom');
    const bar = kids[0];
    assert.ok(bar, 'the scrollbar track is hung on the stage');
    assert.equal(bar.className, 'sketch-present-scroll', 'the track is the Present scrollbar');
    assert.equal(created.length, 2, 'one track and one thumb are built, once');
    assert.equal(bar.firstChild.style.height, '50%', 'the thumb is the visible share of the content');
    assert.equal(bar.firstChild.style.top, '50%', 'at the bottom boundary the thumb sits flush with the track end (100 - 50)');
    assert.ok(bar.classes.indexOf('is-visible') >= 0, 'a real scroll shows the scrollbar');
    assert.equal(Interaction.presentScrollBy(0), false, 'a zero delta carries no motion');
    assert.equal(Interaction.presentScrollBy(NaN), false, 'a junk delta carries no motion');
    bounds.maxY = 800;
    assert.equal(Interaction.presentScrollBy(10), false, 'content that fits scrolls nowhere');
    assert.equal(camera.cy, 1500, 'and the camera stays where it is');
    Interaction.presentReclamp();
    assert.equal(camera.cy, 1500, 'a fitting picture is never pulled by a reclamp');
    bounds.maxY = 2000;
    camera.cy = 1600;
    Interaction.presentReclamp();
    assert.equal(camera.cy, 1500, 'a camera left past the range by a resize comes back inside it');
    camera.cy = 300;
    Interaction.presentReclamp();
    assert.equal(camera.cy, 500, 'a camera left above the range comes back inside it');

    const prevented = [];
    const wheel = (target, deltaY) => {
      const event = { target, deltaY, deltaMode: 0, prevented: false, preventDefault() { this.prevented = true; } };
      stage.on.wheel(event);
      prevented.push(event.prevented);
      return event;
    };
    camera.cy = 1000;
    const before = camera.cy;
    wheel({ closest: () => '.props-panel' }, -100);
    assert.equal(camera.cy, before, 'a wheel on chrome never moves the Present camera');
    assert.deepEqual(prevented, [false], 'chrome keeps its own native scroll, boundary included');
    wheel({ closest: () => null }, -100);
    assert.equal(camera.cy, before - 200, 'a wheel on the blank ground moves the camera');
    assert.deepEqual(prevented, [false, true], 'the ground swipe takes the default away');

    globalThis.document.documentElement.dataset.sketchMode = 'canvas';
    assert.equal(Interaction.presentScrollBy(-50), false, 'Canvas mode never scrolls the picture');
    Interaction.presentReclamp();
    assert.equal(camera.cy, before - 200, 'Canvas mode never reclamps either');
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

console.log('ok canvas-interaction');
