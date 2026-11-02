import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setSketchMode, getSketchMode, bindSketchMode } from '../../packages/drawer-app/src/kinds/sketch-mode.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/* A fake document with the switch in it. `click(target)` runs the group's click listener, as a browser would. */
function makeDoc() {
  const makeButton = (mode) => ({
    attrs: {},
    dataset: { mode },
    setAttribute(name, value) { this.attrs[name] = value; },
    closest(selector) { return selector === '.sketch-mode-btn' ? this : null; },
  });
  const buttons = { btnSketchCanvas: makeButton('canvas'), btnSketchPresent: makeButton('present') };
  let onClick = null;
  const group = { addEventListener: (type, fn) => { if (type === 'click') onClick = fn; } };
  const html = { dataset: {} };
  const doc = {
    documentElement: html,
    getElementById: (id) => (id === 'sketchModeTools' ? group : buttons[id] || null),
  };
  return { doc, html, buttons, click: (target) => onClick({ target }) };
}

{
  const { doc, html, buttons } = makeDoc();
  bindSketchMode(doc);
  assert.equal(html.dataset.sketchMode, 'canvas', 'every open starts in Canvas');
  assert.equal(buttons.btnSketchCanvas.attrs['aria-pressed'], 'true');
  assert.equal(buttons.btnSketchPresent.attrs['aria-pressed'], 'false');
}

{
  const { doc, html, buttons, click } = makeDoc();
  bindSketchMode(doc);
  click(buttons.btnSketchPresent);
  assert.equal(html.dataset.sketchMode, 'present', 'the Present button turns Present on');
  assert.equal(buttons.btnSketchPresent.attrs['aria-pressed'], 'true');
  assert.equal(buttons.btnSketchCanvas.attrs['aria-pressed'], 'false');
  click({ closest: () => null });
  assert.equal(html.dataset.sketchMode, 'present', 'a click on the gap between the buttons changes nothing');
  click(buttons.btnSketchCanvas);
  assert.equal(html.dataset.sketchMode, 'canvas', 'the Canvas button is the way back');
  assert.equal(buttons.btnSketchCanvas.attrs['aria-pressed'], 'true');
}

{
  // The sketch is told about a switch, once, and never about the reset to Canvas a new frame does.
  const { doc, buttons, click } = makeDoc();
  const seen = [];
  bindSketchMode(doc, (mode) => seen.push(mode));
  assert.deepEqual(seen, [], 'the reset to Canvas at bind time tells nobody');
  click(buttons.btnSketchPresent);
  click(buttons.btnSketchPresent);
  click(buttons.btnSketchCanvas);
  assert.deepEqual(seen, ['present', 'canvas'], 'each switch is reported once, and a click on the mode already on is not a switch');
  click({ closest: () => null });
  assert.deepEqual(seen, ['present', 'canvas'], 'a click between the buttons reports nothing');
}

{
  const { doc } = makeDoc();
  assert.equal(getSketchMode(doc), 'canvas', 'a page that has not set a mode is in Canvas');
  setSketchMode('present', doc);
  assert.equal(getSketchMode(doc), 'present');
  setSketchMode('canvas', doc);
  assert.equal(getSketchMode(doc), 'canvas');
  assert.equal(getSketchMode({ documentElement: null }), 'canvas', 'a page without a root is in Canvas');
}

{
  const { doc, html } = makeDoc();
  setSketchMode('present', doc);
  setSketchMode('canvas', doc);
  assert.equal(html.dataset.sketchMode, 'canvas', 'a new frame resets the mode');
  setSketchMode('anything else', doc);
  assert.equal(html.dataset.sketchMode, 'canvas', 'an unknown mode is Canvas');
  setSketchMode('present', { documentElement: html, getElementById: () => null });
  assert.equal(html.dataset.sketchMode, 'present', 'a page without the switch still takes the mode');
}

{
  const doc = { documentElement: { dataset: {} }, getElementById: () => null };
  bindSketchMode(doc);
  assert.equal(doc.documentElement.dataset.sketchMode, undefined, 'without the switch there is nothing to bind');
}

{
  const mount = read('packages/drawer-app/src/kinds/sketch.js');
  assert.match(mount, /bindSketchMode\(document, postSketchMode\)/, 'the switch is wired once, when the module loads');
  assert.match(mount, /function postSketchMode[\s\S]*?mountedSketch\.sent[\s\S]*?postMessage\(modeMessage\(mode\), "\*"\)/,
    'a switch reaches the frame already up, once it has its render');
  assert.match(mount, /renderMessage\(html, getSessionAppearance\(\), getSketchMode\(document\)\)/,
    'the render carries the mode the user is in, so the fragment reads it when it mounts');
  const themeChange = mount.indexOf('appearanceMessage(getSessionAppearance()), "*")');
  const reset = mount.indexOf('setSketchMode("canvas", document)');
  const newFrame = mount.indexOf('frame.src = SKETCH_RUNNER_URL');
  assert.ok(themeChange > 0 && reset > themeChange, 'a theme change on the frame already up returns before the reset, so it keeps the mode');
  assert.ok(newFrame > reset, 'a new frame is reset to Canvas before it mounts');
  assert.match(mount, /pointer-events:none;/, 'the frame itself stays inert; only the stylesheet opens it in Present');
  assert.doesNotMatch(mount, /pointerEvents/, 'sketch.js does not flip pointer events itself');
}

{
  const html = read('packages/drawer-app/index.html');
  const group = html.match(/<div class="sketch-mode-tools" id="sketchModeTools"[\s\S]*?<\/div>/);
  assert.ok(group, 'the switch is in the page');
  assert.match(group[0], /role="group"/);
  assert.match(group[0], /id="btnSketchCanvas"[^>]*data-mode="canvas"[^>]*aria-pressed="true"/, 'Canvas is pressed by default');
  assert.match(group[0], /id="btnSketchPresent"[^>]*data-mode="present"[^>]*aria-pressed="false"/, 'Present is not');
  assert.ok(html.indexOf('id="sketchModeTools"') > html.indexOf('class="float top-float"'), 'the switch is in the top-left toolbar');
  assert.ok(html.indexOf('id="sketchModeTools"') < html.indexOf('id="preview-stage"'), 'the switch sits before the stage, with the other tool groups');
}

{
  const css = read('packages/drawer-app/css/09-sketch-mode.css');
  assert.match(css, /\.sketch-mode-tools \{\s*display: none;/, 'the switch is hidden unless the kind asks for it');
  assert.match(css, /html\[data-kind="sketch"\] \.sketch-mode-tools \{ display: inline-flex; \}/, 'only Sketch shows it');
  assert.match(css, /html\[data-sketch-mode="present"\] \.sketch-frame \{ pointer-events: auto !important; \}/, 'Present opens the frame');
  assert.doesNotMatch(css, /data-sketch-mode="canvas"/, 'Canvas needs no rule: the frame is inert by default');
}

console.log('ok sketch mode');
