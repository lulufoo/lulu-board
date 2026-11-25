import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validateDiagramSource } from '../../../packages/board-app/workspace/src/kinds/source-validation.js';
import { encodeBase64Utf8 } from '../../../packages/board-app/workspace/src/core/sketch-source.js';
import { encodeMetaPayload } from '../../../packages/board-core/document-format.js';

const root = new URL('../../../', import.meta.url);
const read = rel => fs.readFileSync(new URL(rel, root), 'utf8');
const vendor = { console, setTimeout, clearTimeout };
vendor.window = vendor;
vendor.globalThis = vendor;
vm.runInNewContext(read('third_party/pele/pele.global.js'), vendor);
const pele = vendor.pele;
const templates = {
  boxes: 'boxes.bmd', sketch: 'sketch.skt', flowchart: 'flowchart.mmd', mindmap: 'mindmap.mmd',
  sequence: 'sequenceDiagram.mmd', class: 'classDiagram.mmd', state: 'stateDiagram.mmd', er: 'erDiagram.mmd',
  requirement: 'requirement.mmd', c4: 'C4Context.mmd', usecase: 'usecase-beta.mmd',
  eventmodeling: 'eventmodeling.mmd', railroad: 'railroad-beta.mmd',
};

for (const [kind, file] of Object.entries(templates)) {
  const source = read('packages/board-app/workspace/templates/' + file);
  const result = await validateDiagramSource(source, { pele });
  assert.deepEqual(result, { ok: true, kind, source }, 'the production template validates: ' + kind);
}

const invalidSources = {
  boxes: 'boxes "Bad"\nbox A "One"\nA -> MISSING\n',
  sketch: 'sketch "Bad"\ncontent !!!!\n',
  flowchart: 'flowchart TD\nA -->\n', mindmap: 'mindmap\n',
  sequence: 'sequenceDiagram\nnot valid gibberish\n', class: 'classDiagram\nclass A {\n',
  state: 'stateDiagram-v2\nstate Foo {\n', er: 'erDiagram\nUSER {\n',
  requirement: 'requirementDiagram\nrequirement auth {\n', c4: 'C4Context\nPerson(\n',
  usecase: 'usecase-beta\n(\n', eventmodeling: 'eventmodeling\nnot a statement ???\n',
  railroad: 'railroad-beta\nrule = terminal(\n',
};
for (const [kind, source] of Object.entries(invalidSources)) {
  const result = await validateDiagramSource(source, { pele });
  assert.equal(result.ok, false, kind);
  assert.equal(result.code, 'INVALID_SOURCE', kind);
  assert.equal(typeof result.message, 'string');
  assert.ok(result.message.length, kind);
}

for (const source of [null, {}, 12, '', ' \n', 'unknown\n', 'gantt\n', 'pie\n"One": 1\n']) {
  assert.equal((await validateDiagramSource(source, { pele })).code, 'INVALID_SOURCE', 'unsupported/empty Source is refused');
}
assert.equal((await validateDiagramSource('mindmap\n  First\n  Second\n')).code, 'INVALID_SOURCE', 'mindmap diagnostics are not ignored');
assert.equal((await validateDiagramSource('boxes "Bad"\nbox A "One"\nbox A "Two"\n')).code, 'INVALID_SOURCE', 'Boxes semantic errors use the real parser');

{
  const source = '%% style eyJmb250X3NpemUiOjJ9\nflowchart TD\n  A --> B\n';
  const result = await validateDiagramSource(source, { pele });
  assert.deepEqual(result, { ok: true, kind: 'flowchart', source }, 'renderer style remains in returned full Source');
  const meta = 'meta ' + encodeMetaPayload({ id: 'b_aabbccdd', version: 3 }) + '\n';
  assert.equal((await validateDiagramSource(meta + source, { pele })).source, source, 'legacy identity is stripped by the shared ingress codec');
}

{
  const source = 'flowchart TD\nA --> B\n';
  assert.equal((await validateDiagramSource(source)).code, 'INVALID_SOURCE', 'missing parser refuses before a page write');
  let parsed = '';
  const injected = {
    async parse(body) { parsed = body; return { type: 'flowchart' }; },
    render() { throw new Error('validation must not render'); },
    mount() { throw new Error('validation must not mount'); },
  };
  assert.equal((await validateDiagramSource(source, { pele: injected })).ok, true);
  assert.equal(parsed, source.trim());
  assert.equal((await validateDiagramSource(source, { pele: { parse: () => ({ type: 'gantt' }) } })).code, 'INVALID_SOURCE');
  assert.equal((await validateDiagramSource(source, { pele: { parse: () => Promise.reject(new Error('parser rejected')) } })).code, 'INVALID_SOURCE');
  const originalWindow = globalThis.window;
  globalThis.window = { pele: injected };
  try { assert.equal((await validateDiagramSource(source)).ok, true, 'the browser default uses its existing parser'); }
  finally { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; }
}

{
  const sketch = token => 'sketch "Title"\ncontent ' + token + '\n';
  for (const token of ['A', '====', 'YQ=', 'YR==', '/w==', 'wyg=', 'YQ==junk', 'SGVsbG8_', 'IA==']) {
    assert.equal((await validateDiagramSource(sketch(token))).code, 'INVALID_SOURCE', 'strict shared-codec round trip rejects ' + token);
  }
  const fragment = '<div>你好 👋</div>';
  const token = encodeBase64Utf8(fragment);
  for (const raw of [token, token.replace(/=+$/, '')]) {
    assert.equal((await validateDiagramSource(sketch(raw))).ok, true, 'valid UTF-8 works with optional Base64 padding');
  }
  for (const source of [
    'sketch "Title"\n', 'sketch unquoted\ncontent ' + token,
    'sketch "Title"\ncontent ' + token + '\ncontent ' + token,
    'sketch "Title"\ncontent ' + token + '\nunknown statement',
  ]) {
    assert.equal((await validateDiagramSource(source)).code, 'INVALID_SOURCE', 'malformed Sketch envelope is refused');
  }
}

{
  const originalDocument = globalThis.document;
  globalThis.__sourceValidationScriptRan = false;
  globalThis.document = new Proxy({}, { get() { throw new Error('validation must not access the page DOM'); } });
  try {
    const fragment = '<script>globalThis.__sourceValidationScriptRan = true;</script><div onload="globalThis.__sourceValidationScriptRan = true">Safe validation</div>';
    const source = 'sketch "Script stays inert"\ncontent ' + encodeBase64Utf8(fragment) + '\n';
    assert.equal((await validateDiagramSource(source)).ok, true);
    assert.equal(globalThis.__sourceValidationScriptRan, false, 'candidate scripts and event handlers do not run while validating');
    assert.equal((await validateDiagramSource('boxes "Still inert"\nbox A "Text"\n')).ok, true);
  } finally {
    delete globalThis.__sourceValidationScriptRan;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

console.log('ok full Source validation for thirteen kinds without page mutation or rendering');
