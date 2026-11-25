import assert from 'node:assert/strict';
import { createWebMcpLifecycle } from '../../../packages/board-app/workspace/src/chrome/webmcp.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate, label) {
  for (let turn = 0; turn < 20; turn += 1) {
    if (predicate()) return;
    await tick();
  }
  assert.ok(predicate(), label);
}

// Native registration may expose a partial pair while registerTool is pending.
// Aborting removes that group's names immediately, but pending promises settle
// independently. A late resolution cannot resurrect an aborted registration.
function registry(actions = []) {
  const calls = [], tools = new Map();
  let duplicate = false;
  const api = {
    registerTool(tool, options) {
      const index = calls.length;
      const entry = { tool, signal: options && options.signal };
      calls.push(entry);
      assert.ok(entry.signal instanceof AbortSignal, 'native tools have an abortable registration');
      if (tools.has(tool.name)) { duplicate = true; throw new Error('duplicate native tool name'); }
      const action = actions[index];
      if (action === 'throw') throw new Error('native registration threw');
      tools.set(tool.name, entry);
      const remove = () => { if (tools.get(tool.name) === entry) tools.delete(tool.name); };
      entry.signal.addEventListener('abort', remove, { once: true });
      if (entry.signal.aborted) remove();
      if (action === 'reject') return Promise.reject(new Error('native registration rejected'));
      if (action && action.promise) return action.promise;
      return Promise.resolve();
    },
  };
  return { api, calls, tools, duplicates() { return duplicate; } };
}

function setup(actions, overrides = {}) {
  const native = registry(actions);
  const reads = [], updates = [];
  let target = 'owner:b_aabbccdd';
  let read = input => ({ ok: true, diagram_id: input.diagram_id, kind: 'boxes', source: 'boxes "Draft"\n', revision: 'page:1', save_status: 'saving' });
  let update = async input => ({ ok: true, diagram_id: input.diagram_id, revision: 'page:2', save_status: 'saved' });
  const lifecycle = createWebMcpLifecycle({
    getModelContext: () => native.api,
    getTarget: () => target,
    readDiagram(input) { reads.push(input); return read(input); },
    updateDiagram(input, options) { updates.push({ input, options }); return update(input, options); },
    ...overrides,
  });
  return {
    ...native, reads, updates, lifecycle,
    target(value) { target = value; lifecycle.reconcile(); },
    read(fn) { read = fn; }, update(fn) { update = fn; },
    tool(name) { const entry = native.tools.get(name); assert.ok(entry, name + ' is registered'); return entry.tool; },
  };
}
const READ = 'get_current_diagram';
const UPDATE = 'update_current_diagram';
const INPUT = { diagram_id: 'b_aabbccdd', expected_revision: 'page:1', source: 'boxes "Next"\n' };
function unavailable(result) {
  assert.equal(result.ok, false); assert.equal(result.code, 'NOT_AVAILABLE');
  assert.equal(typeof result.message, 'string'); assert.ok(result.message.length);
}

{
  for (const context of [null, {}, { registerTool: false }]) {
    const p = setup([], { getModelContext: () => context });
    await p.lifecycle.settled(); p.lifecycle.reconcile(); await p.lifecycle.settled();
    assert.equal(p.calls.length, 0, 'unsupported browsers stay usable without tool calls');
    p.lifecycle.dispose();
  }
  for (const ports of [
    { getModelContext() { throw new Error('getter blocked'); } },
    { getTarget() { throw new Error('target unavailable'); } },
    { getTarget() { return null; } },
  ]) {
    const p = setup([], ports);
    await p.lifecycle.settled();
    assert.equal(p.calls.length, 0);
    assert.doesNotThrow(() => p.lifecycle.reconcile());
    p.lifecycle.dispose();
  }
}

{
  const p = setup();
  await p.lifecycle.settled();
  assert.equal(p.calls.length, 2, 'constructing starts registration without another reconcile call');
  assert.equal(p.calls[0].signal, p.calls[1].signal, 'one controller owns the pair');
  assert.deepEqual([...p.tools.keys()].sort(), [READ, UPDATE].sort());
  for (const name of [READ, UPDATE]) {
    const tool = p.tool(name);
    assert.equal(typeof tool.description, 'string'); assert.ok(tool.description.length);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal('outputSchema' in tool, false, 'native JSON output has no unsupported outputSchema field');
    assert.equal(tool.annotations.readOnlyHint, name === READ);
    assert.equal(tool.annotations.untrustedContentHint, true);
    const fields = name === READ ? ['diagram_id'] : ['diagram_id', 'expected_revision', 'source'];
    assert.deepEqual(tool.inputSchema.required.slice().sort(), fields.slice().sort());
    assert.deepEqual(Object.keys(tool.inputSchema.properties).sort(), fields.slice().sort());
    fields.forEach(field => assert.equal(tool.inputSchema.properties[field].type, 'string'));
  }
  const readInput = { diagram_id: INPUT.diagram_id };
  const readResult = await p.tool(READ).execute(readInput);
  assert.equal(readResult.ok, true); assert.equal(readResult.source, 'boxes "Draft"\n');
  assert.equal(Array.isArray(readResult), false); assert.equal('content' in readResult, false, 'returns native JSON rather than an MCP content envelope');
  assert.deepEqual(p.reads, [readInput]);
  const controller = new AbortController();
  const updated = await p.tool(UPDATE).execute(INPUT, { signal: controller.signal });
  assert.equal(updated.ok, true); assert.equal(updated.revision, 'page:2');
  assert.equal(p.updates[0].options.signal, controller.signal, 'only the native execute signal reaches the writer');
  assert.equal(p.updates[0].options.isAvailable(), true);
  const wrong = { ok: false, code: 'DIAGRAM_MISMATCH', message: 'wrong target' };
  const stale = { ok: false, code: 'STALE_REVISION', message: 'stale draft' };
  p.read(() => wrong); p.update(async () => stale);
  assert.deepEqual(await p.tool(READ).execute({ diagram_id: 'b_11223344' }), wrong, 'target errors are not rewritten');
  assert.deepEqual(await p.tool(UPDATE).execute(INPUT), stale, 'revision errors are not rewritten');
  p.lifecycle.reconcile(); p.lifecycle.reconcile(); await p.lifecycle.settled();
  assert.equal(p.calls.length, 2, 'same key does not duplicate a pair');
  const aborted = new AbortController(); aborted.abort();
  const before = [p.reads.length, p.updates.length];
  unavailable(await p.tool(READ).execute(readInput, { signal: aborted.signal }));
  unavailable(await p.tool(UPDATE).execute(INPUT, { signal: aborted.signal }));
  assert.deepEqual([p.reads.length, p.updates.length], before, 'cancelled execution never reaches the ports');
  p.lifecycle.dispose(); await p.lifecycle.settled();
  assert.equal(p.tools.size, 0);
}

{
  const p = setup(); await p.lifecycle.settled();
  const oldRead = p.tool(READ), oldUpdate = p.tool(UPDATE);
  p.target(null);
  assert.equal(p.tools.size, 0, 'off aborts registration synchronously');
  unavailable(await oldRead.execute({ diagram_id: INPUT.diagram_id }));
  unavailable(await oldUpdate.execute(INPUT));
  p.target('owner:b_aabbccdd'); await p.lifecycle.settled();
  unavailable(await oldUpdate.execute(INPUT), 'the same target key does not revive an old callback');
  const routedRead = p.tool(READ), routedUpdate = p.tool(UPDATE);
  p.target('owner:b_11223344');
  unavailable(await routedRead.execute({ diagram_id: INPUT.diagram_id }));
  unavailable(await routedUpdate.execute(INPUT));
  await p.lifecycle.settled();
  assert.equal(p.tools.size, 2); assert.equal(p.duplicates(), false);
  assert.deepEqual([p.reads.length, p.updates.length], [0, 0]);
  p.lifecycle.dispose();
}

{
  for (const failingIndex of [0, 1]) {
    const failing = deferred();
    const p = setup(failingIndex === 0 ? [failing] : [undefined, failing]);
    await until(() => p.calls.length === failingIndex + 1, 'the pending registration started');
    for (const entry of p.calls) unavailable(await entry.tool.execute(INPUT), 'a partial pair cannot execute');
    assert.deepEqual([p.reads.length, p.updates.length], [0, 0]);
    failing.reject(new Error('async native registration failed'));
    await p.lifecycle.settled();
    assert.equal(p.tools.size, 0, 'failure aborts every partially registered tool');
    assert.equal(p.calls[0].signal.aborted, true);
    const failedCalls = p.calls.length;
    p.lifecycle.reconcile(); p.lifecycle.reconcile(); await p.lifecycle.settled();
    assert.equal(p.calls.length, failedCalls, 'failure on the same key cannot hot-loop');
    p.target(null); p.target('owner:b_aabbccdd'); await p.lifecycle.settled();
    assert.equal(p.tools.size, 2, 'off/on permits a fresh attempt');
    assert.equal(p.calls.length, failedCalls + 2);
    assert.equal(p.duplicates(), false); p.lifecycle.dispose();
  }
  for (const actions of [['throw'], [undefined, 'throw']]) {
    const p = setup(actions); await p.lifecycle.settled();
    assert.equal(p.tools.size, 0, 'a synchronous native exception also removes the group');
    assert.equal(p.calls[0].signal.aborted, true); p.lifecycle.dispose();
  }
}

{
  const registering = deferred(); const p = setup([registering]);
  await until(() => p.calls.length === 1, 'first register is pending');
  const oldRead = p.calls[0].tool;
  p.target(null); p.target('owner:b_aabbccdd'); p.target(null); p.target('owner:b_aabbccdd');
  assert.equal(p.calls[0].signal.aborted, true); assert.equal(p.tools.size, 0);
  await tick(); assert.equal(p.calls.length, 1, 'rapid toggling waits for the aborted native call to settle');
  registering.resolve(); await p.lifecycle.settled();
  assert.equal(p.calls.length, 3); assert.equal(p.tools.size, 2); assert.equal(p.duplicates(), false);
  unavailable(await oldRead.execute({ diagram_id: INPUT.diagram_id }));
  p.lifecycle.dispose();
  const secondRegister = deferred(); const switched = setup([undefined, secondRegister]);
  await until(() => switched.calls.length === 2, 'second register is pending');
  const oldUpdate = switched.calls[1].tool;
  switched.target('owner:b_11223344'); await tick();
  assert.equal(switched.calls.length, 2, 'target switching serializes behind the pending old registration');
  assert.equal(switched.tools.size, 0); unavailable(await oldUpdate.execute(INPUT));
  secondRegister.resolve(); await switched.lifecycle.settled();
  assert.equal(switched.calls.length, 4); assert.equal(switched.tools.size, 2); assert.equal(switched.duplicates(), false);
  switched.lifecycle.dispose();
}

{
  const registering = deferred(); const p = setup([registering]);
  await until(() => p.calls.length === 1, 'pending register exists before disposal');
  p.lifecycle.dispose(); p.lifecycle.dispose();
  assert.equal(p.calls[0].signal.aborted, true); assert.equal(p.tools.size, 0);
  unavailable(await p.calls[0].tool.execute(INPUT));
  let settled = false;
  const done = p.lifecycle.settled().then(() => { settled = true; });
  await tick(); assert.equal(settled, false, 'dispose does not pretend the native pending registration settled');
  registering.resolve(); await done;
  p.lifecycle.reconcile(); await p.lifecycle.settled();
  assert.equal(p.calls.length, 1, 'disposal prevents later registration');
}

{
  const p = setup(); await p.lifecycle.settled();
  const entered = deferred(), save = deferred();
  p.update(async (_input, options) => { entered.resolve(options); return save.promise; });
  const controller = new AbortController();
  const executing = p.tool(UPDATE).execute(INPUT, { signal: controller.signal });
  const options = await entered.promise;
  p.target(null); await p.lifecycle.settled();
  assert.equal(p.calls[0].signal.aborted, true);
  assert.equal(controller.signal.aborted, false, 'withdrawing tools does not abort an already-applied update');
  assert.equal(options.signal, controller.signal); assert.equal(options.isAvailable(), false);
  const receipt = { ok: true, diagram_id: INPUT.diagram_id, revision: 'applied:2', save_status: 'saved' };
  save.resolve(receipt);
  assert.deepEqual(await executing, receipt, 'an entered writer can finish and return its actual receipt');
  p.lifecycle.dispose();
}

{
  const p = setup(); await p.lifecycle.settled();
  const validating = deferred(), entered = deferred(); let mutations = 0;
  p.update(async (_input, options) => {
    entered.resolve(options); await validating.promise;
    if (!options.isAvailable()) return { ok: false, code: 'NOT_AVAILABLE', message: 'the original execute group was withdrawn' };
    mutations += 1; return { ok: true, revision: 'should-not-commit' };
  });
  const old = p.tool(UPDATE).execute(INPUT); const options = await entered.promise;
  p.target(null); p.target('owner:b_aabbccdd'); await p.lifecycle.settled();
  assert.equal(options.isAvailable(), false, 'off/on cannot restore an old in-flight validator guard');
  validating.resolve(); unavailable(await old);
  assert.equal(mutations, 0); assert.equal(p.tools.size, 2);
  p.lifecycle.dispose();
}

console.log('ok native WebMCP pair metadata, cancellation, serial registration, retries, and in-flight execute guards');
