/* In-memory draft generation. Never a cloud version, identity, or persisted document field. */
export function createPageRevision() {
  const seed = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  let generation = 0;
  let observedSource;
  function token() { return seed + ':' + generation.toString(36); }
  return {
    observe: function (source) {
      const text = String(source == null ? '' : source);
      if (text !== observedSource) {
        observedSource = text;
        generation += 1;
      }
      return token();
    },
    invalidate: function () { generation += 1; return token(); },
    get: token,
  };
}

const pageRevision = createPageRevision();
export function observePageSource(source) { return pageRevision.observe(source); }
export function invalidatePageRevision() { return pageRevision.invalidate(); }
export function getPageRevision() { return pageRevision.get(); }
