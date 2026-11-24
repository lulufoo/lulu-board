/* In-memory draft generation. Never a cloud version, identity, or persisted document field. */
export function createPageRevision() {
  const seed = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  let generation = 0;
  let observedSource;
  const listeners = new Set();
  function token() { return seed + ':' + generation.toString(36); }
  function advance() {
    generation += 1;
    listeners.forEach(function (listener) {
      try { listener(); } catch (_error) { /* Observers cannot interrupt editing. */ }
    });
    return token();
  }
  return {
    observe: function (source) {
      const text = String(source == null ? '' : source);
      if (text !== observedSource) {
        observedSource = text;
        advance();
      }
      return token();
    },
    invalidate: advance,
    get: token,
    subscribe: function (listener) { listeners.add(listener); return function () { listeners.delete(listener); }; },
  };
}

const pageRevision = createPageRevision();
export function observePageSource(source) { return pageRevision.observe(source); }
export function invalidatePageRevision() { return pageRevision.invalidate(); }
export function getPageRevision() { return pageRevision.get(); }
export function subscribePageRevision(listener) { return pageRevision.subscribe(listener); }
