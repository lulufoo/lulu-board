/* Browser-only collaboration preference. Stores one boolean, never document or account data. */
export const WEBMCP_PREFERENCE_KEY = 'drawer.webmcp.enabled';

export function createWebMcpPreference(storageSource) {
  const listeners = new Set();
  let current;

  function restore() {
    try {
      const storage = storageSource();
      if (!storage) throw new Error('storage unavailable');
      const raw = storage.getItem(WEBMCP_PREFERENCE_KEY);
      if (raw !== null && raw !== 'true' && raw !== 'false') throw new Error('invalid preference');
      return Object.freeze({ enabled: raw !== 'false', storageError: '' });
    } catch (_error) {
      // An unreadable stored opt-out must never become a temporary opt-in.
      return Object.freeze({ enabled: false, storageError: 'read' });
    }
  }

  function publish(next) {
    if (current.enabled === next.enabled && current.storageError === next.storageError) return current;
    current = next;
    listeners.forEach(function (listener) {
      try { listener(current); } catch (_error) { /* A subscriber cannot block a preference change. */ }
    });
    return current;
  }

  // Restore synchronously before callers can read or subscribe.
  current = restore();
  return {
    get: function () { return current; },
    set: function (enabled) {
      if (typeof enabled !== 'boolean') throw new TypeError('WebMCP preference must be a boolean');
      let storageError = '';
      try {
        const storage = storageSource();
        if (!storage) throw new Error('storage unavailable');
        storage.setItem(WEBMCP_PREFERENCE_KEY, String(enabled));
      } catch (_error) {
        storageError = 'write';
      }
      return publish(Object.freeze({ enabled: enabled, storageError: storageError }));
    },
    subscribe: function (listener) {
      listeners.add(listener);
      return function () { listeners.delete(listener); };
    },
    reload: function () { return publish(restore()); },
  };
}

const preference = createWebMcpPreference(function () { return globalThis.localStorage; });

export function getWebMcpPreference() { return preference.get(); }
export function getWebMcpEnabled() { return preference.get().enabled; }
export function setWebMcpEnabled(enabled) { return preference.set(enabled); }
export function subscribeWebMcpPreference(listener) { return preference.subscribe(listener); }

if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('storage', function (event) {
    if (event.key === WEBMCP_PREFERENCE_KEY || event.key === null) preference.reload();
  });
}
