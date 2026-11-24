import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createPageRevision } from '../../../packages/board-app/workspace/src/core/page-revision.js';
import { createWebMcpPreference, WEBMCP_PREFERENCE_KEY } from '../../../packages/board-app/workspace/src/core/webmcp-preference.js';
import { createWebMcpLifecycle } from '../../../packages/board-app/workspace/src/chrome/webmcp.js';
import Route from '../../../packages/board-app/workspace/src/core/cloud-route.js';
import DrawerStyleLine from '../../../packages/board-app/workspace/src/core/style-line.js';

const root = new URL('../../../', import.meta.url);
const read = rel => fs.readFileSync(new URL('packages/board-app/workspace/src/' + rel, root), 'utf8');
function moduleBody(source) {
  return source.replace(/^export \* from [^;]+;\n/gm, '').replace(/^import [\s\S]*?;\n/gm, '').replace(/^export /gm, '');
}
function productionFunction(source, name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, name);
  const tail = source.slice(match.index + match[0].length);
  const next = /\n(?:(?:async )?function |\(function |export )/.exec(tail);
  assert.ok(next, name + ' has a following declaration');
  return source.slice(match.index, match.index + match[0].length + next.index);
}
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const READ = 'get_current_diagram';
const UPDATE = 'update_current_diagram';
const INITIAL_ID = 'b_aabbccdd';
const OTHER_ID = 'b_11223344';
const ORIGINAL = 'boxes "Original"\nbox A "One"\n';
const CANDIDATE = 'boxes "Updated"\nbox A "Two"\n';

{
  const revision = createPageRevision();
  const seen = [];
  revision.subscribe(() => { throw new Error('observer failed'); });
  const stop = revision.subscribe(() => seen.push(revision.get()));
  assert.doesNotThrow(() => revision.observe('one'), 'an observer cannot interrupt an edit');
  revision.observe('one');
  assert.equal(seen.length, 1, 'observing identical Source does not notify');
  revision.invalidate();
  assert.equal(seen.length, 2, 'context invalidation notifies');
  assert.notEqual(seen[0], seen[1]);
  stop(); revision.observe('two'); revision.invalidate();
  assert.equal(seen.length, 2, 'unsubscribing stops notifications');
}

// Run the real composition statements, current-page port, cloud setters, and D
// transaction. Only native registry, DOM, validator, renderer, and saver are ports.
function page(storedPreference) {
  const storage = new Map(storedPreference == null ? [] : [[WEBMCP_PREFERENCE_KEY, storedPreference]]);
  const writes = [];
  const preference = createWebMcpPreference(() => ({
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); storage.set(key, value); },
  }));
  const revision = createPageRevision();
  const editor = { value: ORIGINAL };
  const registered = new Map(), calls = [], events = new Map();
  const renders = [], schedules = [], saves = [], cleared = [];
  let validate = async source => ({ ok: true, kind: 'boxes', source });
  let render = async () => ({ ok: true });
  let save = async () => ({ ok: true, save_status: 'saved' });
  const api = {
    registerTool(tool, options) {
      assert.equal(registered.has(tool.name), false, 'composition cannot duplicate native names');
      const entry = { tool, signal: options.signal };
      calls.push(entry); registered.set(tool.name, entry);
      options.signal.addEventListener('abort', () => { if (registered.get(tool.name) === entry) registered.delete(tool.name); }, { once: true });
      return Promise.resolve();
    },
  };
  const context = {
    console, Promise, Number, String, Object, Array, Math,
    document: { modelContext: api }, location: { hash: '#b:' + INITIAL_ID }, diagramSourceEl: editor,
    window: { addEventListener(type, listener) { events.set(type, listener); } },
    history: { replaceState(_state, _unused, href) { context.location.hash = href.includes('#') ? '#' + href.split('#')[1] : ''; } },
    cloudDiagramIdFromHash: Route.cloudDiagramIdFromHash, DrawerStyleLine,
    observePageSource(source) { return revision.observe(source); },
    getPageRevision() { return revision.get(); }, invalidatePageRevision() { return revision.invalidate(); },
    subscribePageRevision(listener) { return revision.subscribe(listener); },
    getWebMcpEnabled() { return preference.get().enabled; }, subscribeWebMcpPreference(listener) { return preference.subscribe(listener); },
    createWebMcpLifecycle,
    register() {}, $() { return null; }, setCharsLabel() {},
    isShareGuest() { return false; }, cloudHasSaveConflict() { return false; },
    clearTimeout(id) { cleared.push(id); },
    validateDiagramSource(source) { return validate(source); },
    renderDiagram(opts) { renders.push({ opts, source: editor.value, revision: revision.get() }); return render(opts); },
    scheduleDiagramSave() { schedules.push(editor.value); context.setDiagramDirty(true); context.setDiagramSaveStatus('saving'); },
    flushDiagramSave(opts) { saves.push({ ...opts }); return save(opts); },
    setDiagramSyncUI(status) { context.setDiagramSaveStatus(status === 'ok' ? 'saved' : status); },
  };
  vm.createContext(context);
  const state = read('state/shell-state.js');
  const stateFunctions = [
    'setDiagramDirty', 'setDiagramSaveStatus', 'getDiagramSaveStatus', 'observeDiagramSource',
    'updateDiagramChars', 'setDiagramSaveTimer', 'setDiagramLocalRev', 'setLiveDiagramId',
  ].map(name => productionFunction(state, name));
  vm.runInContext([
    'var diagramDirty = false, diagramSaveStatus = "saved", diagramLocalRev = 7, diagramServerRev = 7, diagramSaveTimer = 42;',
    'var liveDiagramId = "' + INITIAL_ID + '";',
    ...stateFunctions,
    moduleBody(read('cloud/cloud-state.js')),
    moduleBody(read('state/current-diagram.js')),
    moduleBody(read('kinds/current-diagram-update.js')),
    'setCloudClient({}); setCloudSession({user:{id:"owner"},access_token:"not-returned"});',
    'updateDiagramChars(); beginCloudDiagramView(liveDiagramId); completeCloudDiagramView(captureCloudDiagramView());',
    moduleBody(read('main.js')),
  ].join('\n'), context);
  const lifecycle = vm.runInContext('webMcpLifecycle', context);
  return {
    context, editor, calls, registered, renders, schedules, saves, cleared, writes, lifecycle,
    preference(value) { return preference.set(value); },
    validator(fn) { validate = fn; }, renderer(fn) { render = fn; }, saver(fn) { save = fn; },
    async settled() { await tick(); await lifecycle.settled(); await tick(); await lifecycle.settled(); },
    tool(name) { const entry = registered.get(name); assert.ok(entry, name + ' is registered'); return entry.tool; },
    input() { const current = context.getCurrentDiagram({ diagram_id: vm.runInContext('liveDiagramId', context) }); return { diagram_id: current.diagram_id, expected_revision: current.revision, source: CANDIDATE }; },
    dispose() { lifecycle.dispose(); },
  };
}
function unavailable(result) { assert.equal(result.ok, false); assert.equal(result.code, 'NOT_AVAILABLE'); }

{
  const p = page('false');
  assert.equal(p.calls.length, 0, 'synchronously restored off is considered before construction can register');
  await p.settled(); assert.equal(p.calls.length, 0);
  p.preference(true); await p.settled();
  assert.equal(p.registered.size, 2);
  const old = p.tool(UPDATE);
  p.preference(false);
  assert.equal(p.registered.size, 0, 'preference revocation removes the pair synchronously');
  unavailable(await old.execute(p.input()));
  assert.equal(p.renders.length, 0); assert.equal(p.saves.length, 0);
  assert.deepEqual(p.writes, [[WEBMCP_PREFERENCE_KEY, 'true'], [WEBMCP_PREFERENCE_KEY, 'false']], 'composition writes only the preference boolean');
  p.dispose();
}

{
  const p = page(); await p.settled();
  assert.equal(p.registered.size, 2);
  const transitions = [
    { leave() { p.context.setCloudClient(null); }, return() { p.context.setCloudClient({}); } },
    { leave() { p.context.setCloudDiagramReady(false); }, return() { p.context.setCloudDiagramReady(true); } },
    { leave() { p.context.bumpCloudLoadSeq(); }, return() { p.context.setCloudDiagramReady(true); } },
    { leave() { p.context.setCloudPlusDraftActive(true); }, return() { p.context.setCloudPlusDraftActive(false); } },
    {
      leave() { p.context.setCloudSession(null); },
      return() { p.context.setCloudSession({ user: { id: 'owner' } }); p.context.setCloudDiagramReady(true); },
    },
  ];
  for (const transition of transitions) {
    const old = p.tool(READ); const count = p.calls.length;
    transition.leave();
    unavailable(await old.execute({ diagram_id: INITIAL_ID }));
    await p.settled(); assert.equal(p.registered.size, 0, 'revision notifications withdraw an ineligible page');
    transition.return(); await p.settled();
    assert.equal(p.registered.size, 2); assert.equal(p.calls.length, count + 2);
    unavailable(await old.execute({ diagram_id: INITIAL_ID }), 'a new pair does not revive callbacks from the retired group');
  }
  const unchanged = p.calls.length;
  p.context.setCloudSession({ user: { id: 'owner' }, access_token: 'refreshed' });
  await p.settled(); assert.equal(p.calls.length, unchanged, 'same-user token refresh does not replace the tools');
  const old = p.tool(READ);
  p.context.history.replaceState(null, '', '/#b:' + OTHER_ID);
  p.context.setLiveDiagramId(OTHER_ID);
  unavailable(await old.execute({ diagram_id: INITIAL_ID }));
  await p.settled();
  assert.equal(p.calls.length, unchanged + 2, 'loaded ID notification handles replaceState without a hashchange event');
  assert.equal((await p.tool(READ).execute({ diagram_id: OTHER_ID })).diagram_id, OTHER_ID);
  p.context.setCloudSession({ user: { id: 'another-owner' } }); await p.settled();
  assert.equal(p.registered.size, 0, 'identity switching does not inherit readiness');
  p.context.setCloudDiagramReady(true); await p.settled();
  assert.equal(p.registered.size, 2);
  const stable = p.calls.length;
  const before = await p.tool(READ).execute({ diagram_id: OTHER_ID });
  p.editor.value = 'boxes "Human edited"\n'; p.context.updateDiagramChars();
  await p.settled();
  assert.equal(p.calls.length, stable, 'Source revisions update read data without duplicating same-target registration');
  assert.notEqual((await p.tool(READ).execute({ diagram_id: OTHER_ID })).revision, before.revision);
  p.dispose();
}

{
  const p = page(); await p.settled();
  const validating = deferred(); p.validator(() => validating.promise);
  const input = p.input(); const old = p.tool(UPDATE);
  const pending = old.execute(input);
  p.preference(false); p.preference(true); await p.settled();
  validating.resolve({ ok: true, kind: 'boxes', source: CANDIDATE });
  unavailable(await pending);
  assert.equal(p.editor.value, ORIGINAL);
  assert.deepEqual([p.renders.length, p.schedules.length, p.saves.length, p.cleared.length], [0, 0, 0, 0], 'real D rechecks the original execute-group guard before any mutation');
  assert.equal(p.registered.size, 2);
  p.dispose();
}

{
  const p = page(); await p.settled();
  const rendering = deferred(); p.renderer(() => rendering.promise);
  const input = p.input(); const controller = new AbortController();
  const pending = p.tool(UPDATE).execute(input, { signal: controller.signal });
  await tick();
  assert.equal(p.editor.value, CANDIDATE, 'the real transaction has committed before rendering finishes');
  const appliedRevision = p.renders[0].revision;
  p.preference(false);
  assert.equal(p.registered.size, 0); assert.equal(controller.signal.aborted, false);
  rendering.resolve({ ok: true });
  const receipt = await pending;
  assert.equal(receipt.ok, true); assert.equal(receipt.diagram_id, INITIAL_ID);
  assert.equal(receipt.revision, appliedRevision); assert.equal(receipt.save_status, 'saved');
  assert.equal(p.schedules.length, 1); assert.equal(p.saves.length, 1, 'already-applied Source completes its ordinary save after withdrawal');
  assert.equal(p.saves[0].expected_revision, appliedRevision);
  p.dispose();
}

console.log('ok actual WebMCP composition, synchronous preference restoration, context notifications, and real D execute guards');
