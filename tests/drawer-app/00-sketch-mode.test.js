import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  setSketchMode,
  bindSketchMode,
  getSessionSketchMode,
  setSessionSketchMode,
  readSketchModeCookie,
  writeSketchModeCookie,
  SKETCH_MODE_COOKIE,
} from '../../packages/drawer-app/src/kinds/sketch-mode.js';

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
  setSessionSketchMode('canvas');
  const { doc, html, buttons } = makeDoc();
  bindSketchMode(doc);
  assert.equal(html.dataset.sketchMode, 'canvas', 'with no saved mode, an open starts in Canvas');
  assert.equal(buttons.btnSketchCanvas.attrs['aria-pressed'], 'true');
  assert.equal(buttons.btnSketchPresent.attrs['aria-pressed'], 'false');
}

{
  setSessionSketchMode('present');
  const { doc, html, buttons } = makeDoc();
  bindSketchMode(doc);
  assert.equal(html.dataset.sketchMode, 'present', 'an open applies the saved Present mode');
  assert.equal(buttons.btnSketchPresent.attrs['aria-pressed'], 'true');
  assert.equal(buttons.btnSketchCanvas.attrs['aria-pressed'], 'false');
  setSessionSketchMode('canvas');
}

{
  setSessionSketchMode('canvas');
  const { doc, html, buttons, click } = makeDoc();
  bindSketchMode(doc);
  click(buttons.btnSketchPresent);
  assert.equal(html.dataset.sketchMode, 'present', 'the Present button turns Present on');
  assert.equal(getSessionSketchMode(), 'present', 'the Present button writes the session');
  assert.equal(buttons.btnSketchPresent.attrs['aria-pressed'], 'true');
  assert.equal(buttons.btnSketchCanvas.attrs['aria-pressed'], 'false');
  click({ closest: () => null });
  assert.equal(html.dataset.sketchMode, 'present', 'a click on the gap between the buttons changes nothing');
  assert.equal(getSessionSketchMode(), 'present', 'a gap click does not write the session');
  click(buttons.btnSketchCanvas);
  assert.equal(html.dataset.sketchMode, 'canvas', 'the Canvas button is the way back');
  assert.equal(getSessionSketchMode(), 'canvas', 'the Canvas button writes the session');
  assert.equal(buttons.btnSketchCanvas.attrs['aria-pressed'], 'true');
}

{
  const { doc, html } = makeDoc();
  setSessionSketchMode('present');
  setSketchMode(getSessionSketchMode(), doc);
  assert.equal(html.dataset.sketchMode, 'present', 'a new frame applies the saved mode');
  setSketchMode('canvas', doc);
  assert.equal(getSessionSketchMode(), 'present', 'writing the attribute does not overwrite the cookie');
  setSketchMode('anything else', doc);
  assert.equal(html.dataset.sketchMode, 'canvas', 'an unknown mode is Canvas');
  setSketchMode('present', { documentElement: html, getElementById: () => null });
  assert.equal(html.dataset.sketchMode, 'present', 'a page without the switch still takes the mode');
  setSessionSketchMode('canvas');
}

{
  const doc = { documentElement: { dataset: {} }, getElementById: () => null };
  bindSketchMode(doc);
  assert.equal(doc.documentElement.dataset.sketchMode, undefined, 'without the switch there is nothing to bind');
}

{
  const mount = read('packages/drawer-app/src/kinds/sketch.js');
  assert.match(mount, /bindSketchMode\(document\)/, 'the switch is wired once, when the module loads');
  const themeChange = mount.indexOf('appearanceMessage(getSessionAppearance()), "*")');
  const kept = mount.indexOf('setSketchMode(getSessionSketchMode(), document)');
  const newFrame = mount.indexOf('frame.src = SKETCH_RUNNER_URL');
  assert.ok(themeChange > 0 && kept > themeChange, 'a theme change on the frame already up returns before the mode is applied, so it keeps the mode');
  assert.ok(newFrame > kept, 'a new frame applies the saved mode before it mounts');
  assert.doesNotMatch(mount, /setSketchMode\("canvas"/, 'a new frame does not force Canvas');
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
  assert.match(css, /html\[data-kind="sketch"\]\[data-sketch-mode="present"\] #preview-stage \{ cursor: default; \}/, 'Present drops grab on the ground');
  assert.doesNotMatch(css, /data-sketch-mode="canvas"/, 'Canvas needs no rule: the frame is inert by default');
}

{
  assert.equal(SKETCH_MODE_COOKIE, 'drawer.sketchMode');
  assert.equal(readSketchModeCookie(''), 'canvas');
  assert.equal(readSketchModeCookie('drawer.sketchMode=present'), 'present');
  assert.equal(readSketchModeCookie('foo=1; drawer.sketchMode=present; bar=2'), 'present');
  assert.equal(readSketchModeCookie('drawer.sketchMode=nope'), 'canvas');
  assert.equal(readSketchModeCookie('drawer.sketchMode=%'), 'canvas', 'a broken escape is Canvas and is not written back');
  assert.equal(readSketchModeCookie('drawer.sketchMode=present; other=1; drawer.sketchMode=canvas'), 'canvas');
  assert.equal(readSketchModeCookie('drawer.appearance=dark; drawer.sketchMode=present'), 'present');
  const line = writeSketchModeCookie('present');
  assert.match(line, /^drawer\.sketchMode=present; Path=\/; SameSite=Lax; Max-Age=31536000/);
  assert.doesNotMatch(line, /Domain=/);
  assert.match(writeSketchModeCookie('nope'), /^drawer\.sketchMode=canvas;/);
  assert.equal(setSessionSketchMode('present'), 'present');
  assert.equal(getSessionSketchMode(), 'present');
  assert.equal(setSessionSketchMode('nope'), 'canvas');
  assert.equal(getSessionSketchMode(), 'canvas');
  const src = read('packages/drawer-app/src/kinds/sketch-mode.js');
  assert.match(src, /document\.cookie/, 'sketch mode reads and writes a cookie');
  assert.doesNotMatch(src, /localStorage/, 'sketch mode is not a localStorage key');
}

console.log('ok sketch mode');
