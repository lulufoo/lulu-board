import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createPageRevision } from '../../../packages/board-app/workspace/src/core/page-revision.js';
import Route from '../../../packages/board-app/workspace/src/core/cloud-route.js';
import DrawerStyleLine from '../../../packages/board-app/workspace/src/core/style-line.js';
import { validateDiagramSource } from '../../../packages/board-app/workspace/src/kinds/source-validation.js';

const root = new URL('../../../', import.meta.url);
const read = rel => fs.readFileSync(new URL('packages/board-app/workspace/src/' + rel, root), 'utf8');
const state = read('state/shell-state.js');
function productionFunction(source, name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, 'production function exists: ' + name);
  const tail = source.slice(match.index + match[0].length);
  const next = /\n(?:(?:async )?function |\(function |export )/.exec(tail);
  assert.ok(next, name + ' has a following declaration');
  return source.slice(match.index, match.index + match[0].length + next.index);
}
function moduleBody(source) {
  return source.replace(/^import [\s\S]*?;\n/gm, '').replace(/^export /gm, '');
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const INITIAL_ID = 'b_aabbccdd';
const OTHER_ID = 'b_11223344';
const ORIGINAL = 'boxes "Original"\nbox A "One"\n';
const CANDIDATE = 'boxes "Updated"\nbox A "Two"\n';

// The transaction, target/revision checks, and state mutation hooks run from production.
// Renderer and save boundaries are deferred ports so races have a deterministic order.
function page(options = {}) {
  const revision = createPageRevision();
  const editor = { value: ORIGINAL };
  const renders = [], schedules = [], flushes = [], cleared = [], validations = [];
  let guard = true;
  let validate = source => validateDiagramSource(source);
  let render = async () => ({ ok: true });
  let save = async () => ({ ok: true, save_status: 'saved' });
  const eligibility = { signedIn: true, canEdit: true, ready: true, conflict: false };
  const context = {
    console, Promise, Number, String, Object, Array, Math,
    location: { hash: '#b:' + INITIAL_ID }, diagramSourceEl: editor,
    cloudDiagramIdFromHash: Route.cloudDiagramIdFromHash, DrawerStyleLine,
    observePageSource(source) { return revision.observe(source); },
    getPageRevision() { return revision.get(); }, invalidatePageRevision() { return revision.invalidate(); },
    $() { return null; }, setCharsLabel() {},
    clearTimeout(id) { cleared.push(id); },
    validateDiagramSource(source) { validations.push(source); return validate(source); },
    renderDiagram(opts) {
      const current = context.getCurrentDiagram({ diagram_id: context.liveDiagramId });
      renders.push({ source: editor.value, diagram_id: current.diagram_id, revision: current.revision, opts });
      return render(opts, renders.length);
    },
    scheduleDiagramSave() {
      schedules.push({ diagram_id: context.liveDiagramId, source: editor.value });
      context.setDiagramDirty(true);
      context.setDiagramSaveStatus('saving');
    },
    flushDiagramSave(opts) { flushes.push({ ...opts }); return save(opts); },
    setDiagramSyncUI(status) { context.setDiagramSaveStatus(status === 'ok' ? 'saved' : status); },
  };
  vm.createContext(context);
  const functions = [
    'setDiagramDirty', 'setDiagramSaveStatus', 'getDiagramSaveStatus', 'observeDiagramSource',
    'updateDiagramChars', 'setDiagramSaveTimer', 'setDiagramLocalRev', 'setLiveDiagramId',
  ].map(name => productionFunction(state, name));
  vm.runInContext([
    'var diagramDirty = false, diagramSaveStatus = "saved", diagramLocalRev = 7, diagramServerRev = 7, diagramSaveTimer = 42;',
    'var liveDiagramId = "' + INITIAL_ID + '";',
    ...functions,
    moduleBody(read('state/current-diagram.js')),
    moduleBody(read('kinds/current-diagram-update.js')),
  ].join('\n'), context);
  context.configureCurrentDiagramContext(() => eligibility);
  context.configureCurrentDiagramUpdateGuard(() => guard);
  context.updateDiagramChars();
  if (options.dirty) {
    context.setDiagramDirty(true); context.setDiagramLocalRev(8); context.setDiagramSaveStatus('saving');
  }
  function snapshot() { return context.getCurrentDiagram({ diagram_id: context.liveDiagramId }); }
  return {
    context, editor, renders, schedules, flushes, cleared, validations, eligibility, snapshot,
    input(source = CANDIDATE) { const current = snapshot(); return { diagram_id: current.diagram_id, expected_revision: current.revision, source }; },
    update(input, opts) { return context.updateCurrentDiagram(input, opts); },
    validator(fn) { validate = fn; }, renderer(fn) { render = fn; }, saver(fn) { save = fn; },
    allow(value) { guard = value; },
    edit(source) { editor.value = source; context.updateDiagramChars(); context.setDiagramDirty(true); },
    move(id = OTHER_ID, source = 'boxes "Other page"\n') {
      context.location.hash = '#b:' + id;
      context.setLiveDiagramId(id); editor.value = source; context.updateDiagramChars();
    },
  };
}

{
  for (const source of [undefined, null, '', 'boxes "Bad"\nbox A "One"\nA -> MISSING\n']) {
    const p = page(); const before = p.snapshot();
    const input = p.input(); input.source = source;
    const result = await p.update(input);
    assert.equal(result.code, 'INVALID_SOURCE');
    assert.equal(p.editor.value, ORIGINAL);
    assert.equal(p.snapshot().revision, before.revision, 'invalid input consumes no page token');
    assert.equal(p.context.diagramDirty, false);
    assert.equal(p.context.diagramSaveTimer, 42);
    assert.deepEqual([p.renders.length, p.schedules.length, p.flushes.length, p.cleared.length], [0, 0, 0, 0], 'invalid source has no document/render/save effects');
  }
  const p = page(); p.eligibility.conflict = true;
  assert.equal((await p.update(p.input())).code, 'CLOUD_CONFLICT');
  assert.equal(p.editor.value, ORIGINAL);
  assert.equal(p.renders.length, 0);
}

{
  const changes = [
    { change(p) { p.edit('boxes "Human edit"\n'); }, code: 'STALE_REVISION' },
    { change(p) { p.move(); }, code: 'DIAGRAM_MISMATCH' },
    { change(p) { p.allow(false); }, code: 'NOT_AVAILABLE' },
    { change(p) { p.eligibility.ready = false; }, code: 'TARGET_NOT_READY' },
    { change(_p, signal) { signal.aborted = true; }, code: 'NOT_AVAILABLE' },
  ];
  for (const test of changes) {
    const p = page(); const gate = deferred(); const signal = { aborted: false };
    p.validator(() => gate.promise);
    const pending = p.update(p.input(), { signal });
    test.change(p, signal); const later = p.editor.value;
    gate.resolve({ ok: true, kind: 'boxes', source: CANDIDATE });
    assert.equal((await pending).code, test.code, 'the final post-validation check sees new state');
    assert.equal(p.editor.value, later);
    assert.deepEqual([p.renders.length, p.schedules.length, p.flushes.length, p.cleared.length], [0, 0, 0, 0]);
  }
  const p = page(); p.allow(false);
  assert.equal((await p.update(p.input())).code, 'NOT_AVAILABLE');
  assert.equal(p.validations.length, 0, 'an unavailable page never starts candidate validation');
}

{
  for (const source of [CANDIDATE, ORIGINAL]) {
    const p = page(); const input = p.input(source);
    const [first, second] = await Promise.all([p.update(input), p.update(input)]);
    assert.equal(first.ok, true); assert.equal(second.code, 'STALE_REVISION');
    assert.notEqual(first.revision, input.expected_revision, 'even the same Source consumes its read token');
    assert.deepEqual([p.renders.length, p.schedules.length, p.flushes.length], [1, 1, 1], 'one read token produces only one transaction');
    assert.equal(p.editor.value, source);
    assert.equal(p.flushes[0].diagram_id, INITIAL_ID);
    assert.equal(p.flushes[0].expected_revision, first.revision);
    assert.equal(p.flushes[0].detailed, true);
  }
}

{
  const p = page(); const before = p.snapshot();
  p.renderer(async (_opts, attempt) => attempt === 1 ? { ok: false, code: 'RENDER_FAILED', message: 'runtime failed' } : { ok: true });
  const result = await p.update(p.input());
  assert.equal(result.code, 'RENDER_FAILED'); assert.equal(result.rolled_back, true);
  assert.equal(result.source_changed, false); assert.equal(p.editor.value, ORIGINAL);
  assert.notEqual(result.revision, before.revision, 'rollback does not revive a consumed token');
  assert.equal(p.context.diagramDirty, false); assert.equal(p.context.diagramLocalRev, 7);
  assert.equal(p.renders.length, 2);
  assert.deepEqual([p.schedules.length, p.flushes.length], [0, 0], 'a failed clean-draft render never saves');
  const dirty = page({ dirty: true });
  dirty.renderer(async (_opts, attempt) => attempt === 1 ? { ok: false } : { ok: true });
  assert.equal((await dirty.update(dirty.input())).rolled_back, true);
  assert.equal(dirty.schedules.length, 1, 'the previous dirty draft keeps its own auto-save');
  assert.equal(dirty.schedules[0].source, ORIGINAL);
  assert.equal(dirty.flushes.length, 0);
}

{
  for (const move of [false, true]) {
    for (const rendererResult of [{ ok: false, superseded: true }, { ok: true }]) {
      const p = page(); const rendering = deferred(); p.renderer(() => rendering.promise);
      const pending = p.update(p.input()); await tick();
      const applied = p.renders[0];
      if (move) p.move(); else p.edit('boxes "Later human edit"\n');
      const later = p.editor.value;
      rendering.resolve(rendererResult);
      const result = await pending;
      assert.equal(result.ok, false); assert.equal(result.source_changed, true);
      assert.equal(result.diagram_id, applied.diagram_id); assert.equal(result.revision, applied.revision);
      assert.equal(p.editor.value, later, 'a late render cannot roll back later edits or another page');
      assert.deepEqual([p.renders.length, p.schedules.length, p.flushes.length], [1, 0, 0]);
    }
  }
}

{
  for (const move of [false, true]) {
    const p = page({ dirty: true }); const restoring = deferred();
    p.renderer((_opts, attempt) => attempt === 1 ? Promise.resolve({ ok: false }) : restoring.promise);
    const pending = p.update(p.input()); await tick();
    assert.equal(p.renders.length, 2, 'the original draft is being repainted');
    assert.equal(p.editor.value, ORIGINAL);
    if (move) p.move(); else p.edit('boxes "Edit during rollback render"\n');
    const later = p.editor.value;
    restoring.resolve({ ok: true }); await pending;
    assert.equal(p.editor.value, later);
    assert.equal(p.schedules.length, 0, 'completion of an old rollback render cannot schedule a changed draft or a new page');
    assert.equal(p.flushes.length, 0);
  }
}

{
  for (const code of ['SAVE_FAILED', 'CLOUD_CONFLICT']) {
    const p = page(); const saving = deferred(); p.saver(() => saving.promise);
    const pending = p.update(p.input()); await tick();
    assert.equal(p.flushes.length, 1);
    const applied = p.renders[0]; p.move();
    const later = p.editor.value;
    saving.resolve({ ok: false, code, message: 'server outcome', save_status: code === 'CLOUD_CONFLICT' ? 'conflict' : 'error' });
    const result = await pending;
    assert.equal(result.code, code); assert.equal(result.source_changed, true);
    assert.equal(result.diagram_id, INITIAL_ID); assert.equal(result.revision, applied.revision, 'error receipts retain the applied revision across later navigation');
    assert.equal(p.editor.value, later);
    assert.match(result.message, /Source was updated/);
  }
  const p = page(); const saving = deferred(); p.saver(() => saving.promise);
  const pending = p.update(p.input()); await tick();
  const applied = p.renders[0]; p.move();
  saving.resolve({ ok: true, save_status: 'saved', detached: true, superseded: true });
  const result = await pending;
  assert.equal(result.ok, true); assert.equal(result.detached, true); assert.equal(result.superseded, true);
  assert.equal(result.diagram_id, INITIAL_ID); assert.equal(result.revision, applied.revision);
  const queued = page(); queued.saver(async () => ({ ok: true, save_status: 'saving' }));
  assert.equal((await queued.update(queued.input())).save_status, 'saving', 'a queued save is not reported as saved');
}

console.log('ok current-diagram updates, atomic validation, rollback races, and frozen receipts');
