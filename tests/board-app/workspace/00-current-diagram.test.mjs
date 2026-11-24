import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createPageRevision } from '../../../packages/board-app/workspace/src/core/page-revision.js';
import Route from '../../../packages/board-app/workspace/src/core/cloud-route.js';
import DrawerStyleLine from '../../../packages/board-app/workspace/src/core/style-line.js';
import { stripDocumentMeta } from '../../../packages/board-app/workspace/src/core/document-meta.js';
import BoxesRender from '../../../packages/boxes/index.js';

const root = new URL('../../../', import.meta.url);
const read = rel => fs.readFileSync(new URL('packages/board-app/workspace/src/' + rel, root), 'utf8');
const stateSource = read('state/shell-state.js');
const diagramSource = read('kinds/diagram.js');
const cloudSource = read('cloud/cloud-sync.js');
const boardSource = read('kinds/board.js');

// Execute the production functions against a small page, not alternate mutation implementations.
function productionFunction(source, name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, 'production function exists: ' + name);
  const start = match.index;
  const tail = source.slice(start + match[0].length);
  const next = /\n(?:(?:async )?function |\(function |export )/.exec(tail);
  assert.ok(next, 'function has a following declaration: ' + name);
  return source.slice(start, start + match[0].length + next.index);
}
function moduleBody(source) {
  return source.replace(/^import [\s\S]*?;\n/gm, '')
    .replace(/^export (const|let|var|function) /gm, '$1 ');
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function page(signedIn = true) {
  const revision = createPageRevision();
  const events = new Map();
  const inputs = new Map();
  const errors = [];
  const editor = { value: '', dataset: {}, addEventListener(type, listener) { inputs.set(type, listener); } };
  let fetchGraph = async () => null;
  let groupRefresh = () => null;
  let renderObserver = () => {};
  const hooks = new Map();
  const rootNode = { isConnected: true, classList: { contains() { return true; } }, querySelectorAll() { return []; }, querySelector() { return null; } };
  const buttons = new Map();
  const context = {
    console, Promise, Number, String, Object, Array,
    location: { hash: '#b:b_aabbccdd' },
    document: { getElementById(id) { return buttons.get(id) || null; }, documentElement: { dataset: {} } },
    previewEl: { childElementCount: 1, classList: { add() {} } },
    window: { addEventListener(type, listener) { events.set(type, listener); } },
    diagramSourceEl: editor,
    observePageSource: source => revision.observe(source),
    invalidatePageRevision: () => revision.invalidate(),
    getPageRevision: () => revision.get(),
    cloudDiagramIdFromHash: Route.cloudDiagramIdFromHash,
    DrawerStyleLine, BoxesRender: Object.assign({}, BoxesRender, { render: async () => ({ root: rootNode, board: {} }) }), stripDocumentMeta,
    bindCanvasWorld() {}, setSelectedBoardEdge() {},
    finishCanvasView(opts, result) { opts.completeRender(result || { ok: true }); },
    register(name, fn) { hooks.set(name, fn); },
    newGraphId() { return 'b_55667788'; },
    $() { return null; },
    setCharsLabel() {}, syncSourceDockLabel() {}, syncCloudSaveChrome() {},
    cloudClearDirtyLeave() {},
    setStatus(message, error) { if (error) errors.push(message); }, showDiagramError(error) { errors.push(error); },
    cloudConfigured() { return true; }, cloudShowSignInDialog() {},
    fetchOwnedGraph(id) { return fetchGraph(id); },
    cloudDiagramTitle() { return 'Sample'; },
    cloudSetDiagramHash(id) { context.location.hash = '#b:' + id; }, cloudRefreshGroups() {},
    setTimeout() { return 1; }, clearTimeout() {},
    isDesignKind() { return false; },
    applyDrawerKind() {}, renderFlowchart(opts) { context.finishCanvasView(opts); },
    scheduleDiagramRender() {},
    fetch: async () => { throw new Error('offline'); },
    diagramPersistMode() { return 'hash'; }, encodeDiagramHash: async () => { throw new Error('encode failed'); },
    call(name) {
      if (name === 'cloudDiagramId') return context.cloudDiagramId();
      if (name === 'isShareGuest') return !!context.shareGuest;
      if (name === 'cloudPlusDraftActive') return context.cloudPlusDraftActive;
      if (name === 'askConfirm') return Promise.resolve(context.confirm !== false);
      if (name === 'saveDiagramToCloudResult') return context.saveDiagramToCloudResult(arguments[1]);
      if (hooks.has(name)) return hooks.get(name)(...Array.prototype.slice.call(arguments, 1));
      if (name === 'refreshCloudGroupMembers') return groupRefresh();
      return null;
    },
    emit(name, opts) {
      if (hooks.has(name)) hooks.get(name)(opts);
      if (name === 'scheduleDiagramSave') context.scheduleDiagramSave();
      if (name === 'syncCloudSaveChrome') context.syncCloudSaveChrome();
      if (name === 'renderDiagram') {
        if (context.renderInEmit) context.renderDiagram(opts);
        renderObserver(opts);
      }
    },
  };
  vm.createContext(context);
  const shellFunctions = [
    'setDiagramDirty', 'setDiagramSaveStatus', 'getDiagramSaveStatus', 'observeDiagramSource',
    'updateDiagramChars', 'setDiagramLocalRev', 'setDiagramServerRev', 'setDiagramSaveTimer',
    'bumpDiagramSaveSeq', 'setLiveDiagramId', 'applyDiagramLiveMeta', 'setSelectedBoardNode',
  ].map(name => productionFunction(stateSource, name)).join('\n');
  const diagramFunctions = [
    'sourceBodyForKind', 'holdDiagramSwap', 'renderDiagram', 'bumpClientRevIfSynced', 'scheduleDiagramSave',
    'setDiagramSyncUI', 'diagramSaveDelay', 'saveDiagramToHash', 'saveDiagramToFile',
  ].map(name => productionFunction(diagramSource, name)).join('\n');
  const cloudFunctions = [
    'cloudCachePut', 'cloudCacheGet', 'cloudRememberDiagramRow', 'cloudCachedDiagramRow', 'cloudForgetDiagramCache',
    'cloudRowSource', 'applyCloudDiagramRow', 'cloudClearOpenDiagram',
    'cloudSaveKey', 'cloudHasSaveConflict', 'clearCloudDiagramConflict', 'cloudSaveRefusal', 'refuseCloudSaveConflict',
    'sameCloudSaveContext', 'currentCloudSavePage', 'captureCloudSave', 'rememberCloudSave', 'performCloudSave', 'saveDiagramToCloudResult',
    'cloudSetActionLabel', 'cloudSetSaveSignedOut', 'cloudSaveButtonCopy', 'cloudSaveUncreated', 'cloudVersionsAligned', 'syncCloudSaveChrome',
    'loadCloudDiagramByHash', 'saveDiagramToCloud',
  ].map(name => productionFunction(cloudSource, name)).join('\n');
  const inputStart = read('chrome/chrome-boot.js').indexOf("diagramSourceEl.addEventListener('input'");
  const inputEnd = read('chrome/chrome-boot.js').indexOf('\nif (boardIdEditor)', inputStart);
  const compose = read('main.js').slice(read('main.js').indexOf('configureCurrentDiagramContext(function'));
  vm.runInContext([
    'var diagramDirty = false, diagramSaveStatus = "saved", diagramLocalRev = 1, diagramServerRev = 1, diagramSaveTimer = null, diagramSaveSeq = 0, diagramRenderToken = 0, diagramSwapSeq = 0, pendingDiagramRender = null;'
    , 'const cloudSaveInFlight = new Map(), cloudSaveConflicts = new Set();',
    'var liveDiagramId = "", liveDiagramArchive = "", liveDiagramPath = "", selectedBoardNode = null, selectedBoardEdge = null;',
    'var boardTitleEditor = { value: "" };',
    shellFunctions, diagramFunctions,
    moduleBody(read('cloud/cloud-state.js')),
    cloudFunctions,
    productionFunction(read('cloud/cloud-pull.js'), 'pullDiagramFromCloud'),
    productionFunction(boardSource, 'commitBoardTitle'),
    moduleBody(read('state/current-diagram.js')),
    'function isShareGuest() { return !!this.shareGuest; }',
    compose,
    read('chrome/chrome-boot.js').slice(inputStart, inputEnd),
  ].join('\n'), context);
  context.setCloudClient({});
  if (signedIn) context.setCloudSession({ user: { id: 'owner' }, access_token: 'private-session-token' });
  return {
    context, editor, errors, rootNode, buttons,
    render(opts) { renderObserver(opts); return context.renderDiagram(opts); },
    row(id = 'b_aabbccdd', source = 'boxes "Draft"\nbox A "One"\n') {
      context.applyCloudDiagramRow({ graph_id: id, bmd: source, version: 7 }, { skipShare: true, loaded: true });
      vm.runInContext('completeCloudDiagramView(captureCloudDiagramView())', context);
    },
    snapshot(id = 'b_aabbccdd') { return context.getCurrentDiagram({ diagram_id: id }); },
    check(snapshot, id = snapshot.diagram_id) { return context.checkCurrentDiagram({ diagram_id: id, expected_revision: snapshot.revision }); },
    input(source) { editor.value = source; inputs.get('input')(); },
    route(hash) { context.location.hash = hash; events.get('hashchange')(); },
    fetchGraph(fn) { fetchGraph = fn; },
    groupRefresh(fn) { groupRefresh = fn; },
    onRender(fn) { renderObserver = fn; },
  };
}

{
  const p = page();
  assert.equal(p.snapshot().code, 'TARGET_NOT_READY');
  p.row();
  const clean = p.snapshot();
  assert.equal(clean.ok, true);
  assert.equal(clean.save_status, 'saved');
  assert.equal(typeof clean.revision, 'string');
  assert.deepEqual(Object.keys(clean).sort(), ['ok', 'diagram_id', 'kind', 'source', 'revision', 'save_status'].sort());
  assert.ok(!JSON.stringify(clean).includes('private-session-token'));
  p.input('boxes "Draft"\nbox A "Unsaved one"\n');
  const first = p.snapshot();
  assert.match(first.source, /Unsaved one/);
  assert.equal(first.save_status, 'saving');
  assert.equal(p.context.diagramLocalRev, 8);
  p.input('boxes "Draft"\nbox A "Unsaved two"\n');
  assert.equal(p.context.diagramLocalRev, 8, 'the old localRev is unchanged on the second edit');
  assert.equal(p.check(first).code, 'STALE_REVISION');
  p.input(clean.source);
  assert.equal(p.snapshot().source, clean.source);
  assert.equal(p.check(clean).code, 'STALE_REVISION', 'editing back to original Source cannot revive a snapshot');
  assert.equal(p.context.getCurrentDiagram({}).code, 'DIAGRAM_MISMATCH');
  assert.equal(p.snapshot('b_11223344').code, 'DIAGRAM_MISMATCH');
}

{
  const p = page();
  p.row();
  const before = p.snapshot();
  p.context.selectedBoardNode = { kind: 'box', id: 'A', key: 'box:A', scope: 'shell' };
  p.context.boardTitleEditor.value = 'Canvas title';
  p.context.commitBoardTitle();
  assert.deepEqual(p.errors, []);
  assert.match(p.snapshot().source, /Canvas title/);
  assert.equal(p.check(before).code, 'STALE_REVISION', 'the real Boxes canvas commit invalidates the snapshot');
  const canvas = p.snapshot();
  p.editor.value = 'flowchart TD\nA --> B\n';
  p.context.renderDiagram();
  assert.equal(p.check(canvas).code, 'STALE_REVISION', 'render-only source replacement is observed');
  const rendered = p.snapshot();
  p.context.renderDiagram();
  assert.equal(p.snapshot().revision, rendered.revision, 'repainting the same Source does not invalidate');
}

{
  const sources = {
    boxes: 'boxes "Example"\nbox A "原文"\n',
    sketch: 'sketch "Example"\ncontent PHN0eWxlPjwvc3R5bGU+\n',
    flowchart: 'flowchart TD\nA --> B\n', mindmap: 'mindmap\n  root((Example))\n',
    sequence: 'sequenceDiagram\nA->>B: Hi\n', class: 'classDiagram\nclass Example\n',
    state: 'stateDiagram-v2\n[*] --> Ready\n', er: 'erDiagram\nUSER ||--o{ TASK : owns\n',
    requirement: 'requirementDiagram\n', c4: 'C4Context\n', usecase: 'usecase-beta\n',
    eventmodeling: 'eventmodeling\n', railroad: 'railroad-beta\n',
  };
  const p = page();
  for (const [kind, source] of Object.entries(sources)) {
    p.row('b_aabbccdd', source);
    const snapshot = p.snapshot();
    assert.equal(snapshot.ok, true, kind);
    assert.equal(snapshot.kind, kind);
    assert.equal(snapshot.source, source, 'full Source is preserved for ' + kind);
  }
  p.row('b_aabbccdd', 'gantt\n');
  assert.equal(p.snapshot().code, 'NOT_AVAILABLE', 'closed Mermaid types are not added');
}

{
  const p = page();
  p.row();
  for (const hash of ['#z:payload', '#p:p_' + 'a'.repeat(64), '#s:s_' + 'a'.repeat(32), '']) {
    p.route(hash);
    assert.equal(p.snapshot().code, 'NOT_AVAILABLE');
  }
  p.route('#b:b_aabbccdd');
  p.context.shareGuest = true;
  assert.equal(p.snapshot().code, 'NOT_AVAILABLE');
  p.context.shareGuest = false;
  p.context.setCloudPlusDraftActive(true);
  assert.equal(p.snapshot().code, 'NOT_AVAILABLE');
  p.context.setCloudPlusDraftActive(false);
  const before = p.snapshot();
  p.context.setCloudSession({ user: { id: 'owner' }, access_token: 'refreshed-token' });
  assert.equal(p.snapshot().revision, before.revision, 'same-user token refresh is not a draft edit');
  p.context.setCloudSession(null);
  assert.equal(p.snapshot().code, 'NOT_AVAILABLE');
  p.context.setCloudSession({ user: { id: 'other' } });
  assert.equal(p.snapshot().code, 'TARGET_NOT_READY', 'a new identity cannot inherit the old owner-loaded draft');
}

{
  const p = page();
  p.row();
  const original = p.snapshot();
  p.route('#b:b_11223344');
  const load = deferred();
  p.fetchGraph(() => load.promise);
  const pending = p.context.loadCloudDiagramByHash('#b:b_11223344');
  assert.equal(p.snapshot('b_11223344').code, 'TARGET_NOT_READY', 'URL B with loaded A is refused before await');
  await Promise.resolve();
  load.resolve({ graph_id: 'b_11223344', bmd: 'boxes "Other"\n', version: 1 });
  await pending;
  assert.equal(p.snapshot('b_11223344').diagram_id, 'b_11223344', JSON.stringify(p.errors));
  p.route('#b:b_aabbccdd');
  p.fetchGraph(async () => ({ graph_id: 'b_aabbccdd', bmd: original.source, version: 7 }));
  await p.context.loadCloudDiagramByHash('#b:b_aabbccdd');
  assert.equal(p.check(original).code, 'STALE_REVISION', 'A to B to A cannot revive the first snapshot');
  const reloaded = p.snapshot();
  await p.context.loadCloudDiagramByHash('#b:b_aabbccdd');
  assert.equal(p.check(reloaded).code, 'STALE_REVISION', 'same-ID same-Source reload invalidates');
}

{
  const p = page();
  p.row();
  const before = p.snapshot();
  const pendingPull = deferred();
  p.fetchGraph(() => pendingPull.promise);
  const pull = p.context.pullDiagramFromCloud();
  assert.equal(p.snapshot().code, 'TARGET_NOT_READY');
  pendingPull.resolve({ graph_id: before.diagram_id, bmd: before.source, version: 7 });
  assert.equal(await pull, true);
  assert.equal(p.check(before).code, 'STALE_REVISION', 'same-content Pull invalidates the old snapshot');
  p.fetchGraph(async () => { throw new Error('offline'); });
  assert.equal(await p.context.pullDiagramFromCloud(), false);
  assert.equal(p.snapshot().save_status, 'error', 'a failed Pull retains the loaded draft and exposes its real status');
}

{
  const p = page();
  p.row();
  p.editor.value = 'meta eyJpZCI6ImJfYWFiYmNjZGQiLCJ2ZXJzaW9uIjo3fQ==\n' + p.editor.value;
  p.context.updateDiagramChars();
  const before = p.snapshot();
  const pending = p.context.saveDiagramToCloud();
  assert.equal(p.check(before).code, 'STALE_REVISION', 'normalization before a failed save is observed synchronously');
  assert.equal(await pending, false);
  assert.equal(p.snapshot().save_status, 'error');
  const unchanged = p.snapshot();
  p.context.applyCloudDiagramRow({ graph_id: unchanged.diagram_id, bmd: unchanged.source, version: 8 }, { skipShare: true });
  assert.equal(p.snapshot().revision, unchanged.revision, 'same-source save acknowledgment does not invalidate');
  p.context.setDiagramSyncUI('conflict');
  assert.equal(p.snapshot().save_status, 'conflict');
}

{
  const p = page();
  p.row();
  const oldResponse = deferred();
  const started = deferred();
  p.context.cloudForgetDiagramCache();
  p.fetchGraph(() => { started.resolve(); return oldResponse.promise; });
  const pending = p.context.loadCloudDiagramByHash('#b:b_aabbccdd');
  await started.promise;
  p.context.setCloudSession(null);
  p.context.setCloudSession({ user: { id: 'other' } });
  oldResponse.resolve({ graph_id: 'b_aabbccdd', bmd: 'boxes "Old identity response"\n', version: 9 });
  await pending;
  assert.equal(p.snapshot().code, 'TARGET_NOT_READY', 'a previous-session response cannot make the page ready');
  assert.ok(!p.editor.value.includes('Old identity response'));
  const replacementPage = page();
  replacementPage.row();
  assert.notEqual(replacementPage.snapshot().revision, p.context.getPageRevision(), 'new page lifetimes have distinct opaque seeds');
}

{
  const p = page();
  p.row('b_aabbccdd', 'boxes "Owner-only cached Source"\n');
  assert.ok(p.context.cloudCachedDiagramRow('b_aabbccdd'));
  p.context.setCloudSession({ user: { id: 'different-owner' } });
  assert.equal(p.context.cloudCachedDiagramRow('b_aabbccdd'), null, 'identity change discards the old owned cache');
  let fetched = false;
  p.fetchGraph(async () => { fetched = true; return null; });
  await p.context.loadCloudDiagramByHash('#b:b_aabbccdd');
  assert.equal(fetched, true, 'a new identity must perform its own authorized read');
  assert.equal(p.snapshot().code, 'TARGET_NOT_READY');
  assert.equal(p.editor.value, '', 'a denied load cannot expose the former owner cache');
}

{
  const p = page(); p.row();
  const response = deferred();
  p.context.fetch = () => response.promise;
  const saving = p.context.saveDiagramToCloud();
  p.context.setCloudSession({ user: { id: 'different-owner' } });
  response.resolve({ ok: false, status: 409, text: async () => '{}' });
  assert.equal(await saving, false);
  assert.equal(p.snapshot().code, 'TARGET_NOT_READY', 'an old-session 409 cannot restore readiness');
  assert.equal(p.context.cloudHasSaveConflict(), false, 'an old owner conflict cannot poison the new owner');
}

{
  const p = page();
  p.row();
  const before = p.snapshot();
  const saveResponse = deferred();
  const pullResponse = deferred();
  p.context.fetch = () => saveResponse.promise;
  p.fetchGraph(() => pullResponse.promise);
  const saving = p.context.saveDiagramToCloud();
  const pulling = p.context.pullDiagramFromCloud();
  assert.equal(p.snapshot().code, 'TARGET_NOT_READY');
  saveResponse.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ diagram_id: before.diagram_id, bmd: before.source, version: 8 }) });
  assert.equal(await saving, true);
  assert.equal(p.snapshot().code, 'TARGET_NOT_READY', 'an older save acknowledgment cannot finish an in-flight Pull');
  pullResponse.resolve({ graph_id: before.diagram_id, bmd: before.source, version: 8 });
  assert.equal(await pulling, true);
  assert.equal(p.snapshot().ok, true);
  assert.equal(p.check(before).code, 'STALE_REVISION');
}

{
  const p = page();
  p.row();
  p.context.cloudForgetDiagramCache();
  const sessionReady = deferred();
  p.context.setCloudSessionReady(sessionReady.promise);
  const requests = [];
  p.fetchGraph(async id => { requests.push(id); return { graph_id: id, bmd: 'boxes "Latest route"\n', version: 1 }; });
  const first = p.context.loadCloudDiagramByHash('#b:b_aabbccdd');
  p.route('#b:b_11223344');
  const second = p.context.loadCloudDiagramByHash('#b:b_11223344');
  assert.equal(p.snapshot('b_11223344').code, 'TARGET_NOT_READY');
  sessionReady.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(requests, ['b_11223344'], 'an old load waiting on the session cannot run after a newer load begins');
  assert.equal(p.snapshot('b_11223344').diagram_id, 'b_11223344', JSON.stringify(p.errors));
}

{
  const p = page(false);
  const sessionReady = deferred();
  p.context.setCloudSessionReady(sessionReady.promise);
  p.fetchGraph(async id => ({ graph_id: id, bmd: 'boxes "First authenticated open"\n', version: 1 }));
  const opening = p.context.loadCloudDiagramByHash('#b:b_aabbccdd');
  assert.equal(p.snapshot().code, 'NOT_AVAILABLE');
  p.context.setCloudSession({ user: { id: 'owner' }, access_token: 'restored-token' });
  sessionReady.resolve();
  await opening;
  assert.equal(p.snapshot().ok, true, 'initial session restoration must finish the first pending cloud open');
  assert.match(p.snapshot().source, /First authenticated open/);
}

{
  const p = page();
  p.row();
  p.context.setDiagramSyncUI('error');
  p.route('#b:b_11223344');
  p.row('b_11223344', 'boxes "Saved cloud row"\n');
  assert.equal(p.snapshot('b_11223344').save_status, 'saved', 'a newly loaded row does not inherit another diagram error');
  p.context.applyCloudDiagramRow({ graph_id: 'b_11223344', bmd: 'boxes "Cached draft"\n', version: 7, dirty: true, localRev: 8 }, { skipShare: true, loaded: true });
  vm.runInContext('completeCloudDiagramView(captureCloudDiagramView())', p.context);
  assert.equal(p.snapshot('b_11223344').save_status, 'saving', 'an owned unsaved cache row remains pending');
}

{
  const p = page(); p.row(); p.route('#b:b_11223344');
  const metadata = deferred(), metadataStarted = deferred(), drawing = deferred();
  p.fetchGraph(async id => ({ graph_id: id, bmd: 'boxes "Other"\n', version: 1 }));
  p.context.BoxesRender.render = () => drawing.promise;
  p.groupRefresh(() => { metadataStarted.resolve(); return metadata.promise; });
  const opening = p.context.loadCloudDiagramByHash('#b:b_11223344');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(p.snapshot('b_11223344').code, 'TARGET_NOT_READY', 'loaded Source waits for the actual render');
  drawing.resolve({ root: p.rootNode, board: {} });
  await metadataStarted.promise;
  assert.equal(p.snapshot('b_11223344').ok, true, 'actual render publishes ready while group metadata is pending');
  metadata.resolve(); await opening;
}

{
  const p = page();
  p.row();
  const original = p.snapshot().source;
  const response = deferred();
  p.fetchGraph(() => response.promise);
  const first = p.context.pullDiagramFromCloud();
  assert.equal(await p.context.pullDiagramFromCloud(), false, 'Pull cannot re-enter while the first request owns readiness');
  response.reject(new Error('offline'));
  assert.equal(await first, false);
  assert.equal(p.snapshot().ok, true, 'a failed Pull restores access to the previously loaded draft');
  assert.equal(p.snapshot().source, original);
}


const tick = () => new Promise(resolve => setImmediate(resolve));
const response = (id = 'b_aabbccdd', version = 8, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify({ diagram_id: id, version }) });
{
  const p = page(); p.row(); p.route('#b:b_11223344');
  const firstDrawing = deferred(), secondDrawing = deferred(); let renders = 0;
  p.context.BoxesRender.render = () => (++renders === 1 ? firstDrawing.promise : secondDrawing.promise);
  p.fetchGraph(async id => ({ graph_id: id, bmd: 'boxes "Loaded B"\n', version: 1 }));
  const loading = p.context.loadCloudDiagramByHash('#b:b_11223344'); await tick();
  assert.equal(p.snapshot('b_11223344').code, 'TARGET_NOT_READY');
  p.input('boxes "Human B"\n');
  const replacement = p.render(); await tick();
  assert.equal(p.snapshot('b_11223344').code, 'TARGET_NOT_READY');
  secondDrawing.resolve({ root: p.rootNode, board: {} });
  assert.equal((await replacement).ok, true, 'ready publication does not supersede its own successful render');
  assert.equal(p.snapshot('b_11223344').ok, true, 'human replacement render completes the same loaded-view lease');
  assert.match(p.snapshot('b_11223344').source, /Human B/);
  firstDrawing.resolve({ root: p.rootNode, board: {} }); await loading;
  assert.match(p.snapshot('b_11223344').source, /Human B/);
  const oldLease = p.context.captureCloudDiagramView();
  p.context.bumpCloudLoadSeq();
  p.context.applyCloudDiagramRow({ graph_id: 'b_11223344', bmd: p.editor.value, version: 1 }, { loaded: true });
  assert.equal(p.context.completeCloudDiagramView(oldLease), false, 'a pre-Pull completed render cannot publish the next same-ID load');
  assert.equal(p.snapshot('b_11223344').code, 'TARGET_NOT_READY');
  await p.render(); assert.equal(p.snapshot('b_11223344').ok, true);
}
{
  const p = page(); p.row(); const first = deferred(), second = deferred(); const requests = [];
  p.context.fetch = (_url, opts) => { requests.push(JSON.parse(opts.body)); return requests.length === 1 ? first.promise : second.promise; };
  p.input('boxes "A1"\n'); const saving1 = p.context.saveDiagramToCloudResult();
  p.input('boxes "A2"\n'); const ownRevision = p.snapshot().revision;
  const saving2 = p.context.saveDiagramToCloudResult(), saving3 = p.context.saveDiagramToCloudResult();
  assert.equal(requests.length, 1);
  first.resolve(response()); await tick();
  assert.equal(p.editor.value, 'boxes "A2"\n', 'old success preserves the newer human draft');
  assert.equal(p.context.diagramDirty, true); assert.equal(p.context.diagramServerRev, 8);
  assert.equal(requests.length, 2, 'two waiting saves share one following PATCH');
  assert.equal(requests[1].expected_version, 8, 'the following request absorbs the successful server base');
  second.resolve(response('b_aabbccdd', 9));
  const [r1, r2, r3] = await Promise.all([saving1, saving2, saving3]);
  assert.equal(r1.superseded, true); assert.equal(r2.ok, true); assert.equal(r3.ok, true);
  assert.equal(r2.revision, ownRevision); assert.equal(r3.revision, ownRevision);
  assert.equal(r2.save_status, 'saved'); assert.equal(r3.save_status, 'saved');
  assert.equal(p.context.cloudHasSaveConflict(), false); assert.equal(p.context.diagramDirty, false);
}
{
  const p = page(); p.row(); p.input('boxes "Outgoing A"\n'); p.route('#b:b_11223344');
  const pending = deferred(); let request;
  p.context.fetch = (_url, opts) => { request = JSON.parse(opts.body); return pending.promise; };
  const saving = p.context.saveDiagramToCloudResult();
  assert.equal(request.diagram_id, 'b_aabbccdd', 'outgoing save is bound to the loaded ID, never the new hash');
  p.context.bumpCloudLoadSeq(); p.row('b_11223344', 'boxes "B"\n');
  pending.resolve(response()); const result = await saving;
  assert.equal(result.detached, true); assert.equal(p.editor.value, 'boxes "B"\n');
  assert.equal(p.snapshot('b_11223344').diagram_id, 'b_11223344');
}
{
  const p = page(); p.row(); p.input('boxes "Local conflict draft"\n');
  const classes = () => { const values = new Set(); return { add(value) { values.add(value); }, remove(value) { values.delete(value); }, contains(value) { return values.has(value); } }; };
  const button = () => ({ hidden: true, disabled: false, classList: classes(), attributes: {}, label: { textContent: 'Saved' },
    setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; }, querySelector() { return this.label; } });
  const save = button(), status = button(); p.buttons.set('btnShellSaveCloud', save); p.buttons.set('shellCloudStatus', status);
  let count = 0; p.context.fetch = async () => { count++; return response('b_aabbccdd', 99, 409); };
  const original = p.editor.value; const conflicting = await p.context.saveDiagramToCloudResult();
  assert.equal(conflicting.code, 'CLOUD_CONFLICT'); assert.equal(p.editor.value, original);
  assert.equal(p.context.diagramServerRev, 7, 'remote conflict version is never adopted as a write base');
  assert.equal(p.snapshot().save_status, 'conflict'); assert.equal(status.hidden, false); assert.equal(save.hidden, true);
  assert.equal(status.label.textContent, 'Conflict'); assert.match(status.attributes['aria-label'], /Pull/);
  assert.equal((await p.context.saveDiagramToCloudResult()).code, 'CLOUD_CONFLICT'); assert.equal(count, 1, 'conflict blocks blind retries');
  p.context.confirm = false; assert.equal(await p.context.pullDiagramFromCloud(), false); assert.equal(p.editor.value, original);
  assert.equal(p.context.cloudHasSaveConflict(), true, 'Cancel retains the conflict and draft');
  p.context.confirm = true; p.fetchGraph(async id => ({ graph_id: id, bmd: 'boxes "Remote"\n', version: 99 }));
  assert.equal(await p.context.pullDiagramFromCloud(), true); assert.equal(p.context.cloudHasSaveConflict(), false);
  assert.equal(p.context.diagramServerRev, 99); assert.match(p.editor.value, /Remote/);
  assert.equal(status.label.textContent, 'Saved');
}
console.log('ok current-diagram snapshot and production mutation entrypoints');
