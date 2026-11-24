import assert from 'node:assert/strict';
import {
  createWebMcpPreference,
  WEBMCP_PREFERENCE_KEY,
} from '../../../packages/board-app/workspace/src/core/webmcp-preference.js';

function memory(initial) {
  const values = new Map(initial == null ? [] : [[WEBMCP_PREFERENCE_KEY, initial]]);
  const writes = [];
  return {
    values: values,
    writes: writes,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); values.set(key, value); },
  };
}

{
  const storage = memory();
  const preference = createWebMcpPreference(() => storage);
  assert.deepEqual(preference.get(), { enabled: true, storageError: '' });
  assert.deepEqual(storage.writes, [], 'opening the app does not write a preference');
  const seen = [];
  const unsubscribe = preference.subscribe(state => seen.push(state.enabled));
  preference.set(false);
  assert.equal(preference.get().enabled, false);
  assert.deepEqual(storage.writes, [[WEBMCP_PREFERENCE_KEY, 'false']]);
  assert.equal(createWebMcpPreference(() => storage).get().enabled, false, 'refresh restores opt-out synchronously');
  preference.set(false);
  assert.deepEqual(seen, [false], 'unchanged values do not notify twice');
  preference.set(true);
  assert.deepEqual(seen, [false, true]);
  unsubscribe();
  preference.set(false);
  assert.deepEqual(seen, [false, true]);
  assert.throws(() => preference.set('false'), TypeError);
}

{
  const storage = memory('false');
  const preference = createWebMcpPreference(() => storage);
  const observed = [preference.get().enabled];
  preference.subscribe(state => observed.push(state.enabled));
  assert.deepEqual(observed, [false], 'restoring a disabled value never publishes a temporary enabled state');
  storage.values.set(WEBMCP_PREFERENCE_KEY, 'true');
  preference.reload();
  assert.deepEqual(observed, [false, true], 'other-tab changes can be restored and observed');
  storage.values.delete(WEBMCP_PREFERENCE_KEY);
  preference.reload();
  assert.equal(preference.get().enabled, true, 'cleared preference returns to the default');
}

{
  for (const storageSource of [
    () => { throw new Error('security policy'); },
    () => null,
    () => ({ getItem() { throw new Error('blocked'); } }),
    () => memory('corrupt'),
  ]) {
    assert.deepEqual(createWebMcpPreference(storageSource).get(), { enabled: false, storageError: 'read' });
  }
  const preference = createWebMcpPreference(() => ({
    getItem() { return 'true'; },
    setItem() { throw new Error('quota exceeded'); },
  }));
  const changes = [];
  preference.subscribe(() => { throw new Error('subscriber failed'); });
  preference.subscribe(state => changes.push(state));
  assert.doesNotThrow(() => preference.set(false));
  assert.deepEqual(preference.get(), { enabled: false, storageError: 'write' });
  assert.deepEqual(changes, [{ enabled: false, storageError: 'write' }], 'one listener cannot prevent disabling or other subscribers');
}

{
  const storage = memory('false');
  const originalStorage = globalThis.localStorage;
  const originalListener = globalThis.addEventListener;
  const events = new Map();
  globalThis.localStorage = storage;
  globalThis.addEventListener = (type, handler) => events.set(type, handler);
  try {
    const api = await import('../../../packages/board-app/workspace/src/core/webmcp-preference.js?singleton');
    assert.equal(api.getWebMcpEnabled(), false, 'public singleton restores before its first getter');
    const seen = [];
    const stop = api.subscribeWebMcpPreference(state => seen.push(state.enabled));
    api.setWebMcpEnabled(true);
    storage.values.set(WEBMCP_PREFERENCE_KEY, 'false');
    events.get('storage')({ key: 'unrelated-key' });
    assert.equal(api.getWebMcpEnabled(), true);
    events.get('storage')({ key: WEBMCP_PREFERENCE_KEY });
    assert.equal(api.getWebMcpEnabled(), false);
    assert.deepEqual(seen, [true, false]);
    stop();
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
    if (originalListener === undefined) delete globalThis.addEventListener;
    else globalThis.addEventListener = originalListener;
  }
}

console.log('ok webmcp-preference');
