/* State theme packs API — mirrors MermaidSequenceThemes. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidStateThemes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const IDS = ['default', 'classic', 'pastel', 'kami'];

  function resolveId(raw) {
    const id = String(raw || '').trim().toLowerCase();
    return IDS.indexOf(id) >= 0 ? id : 'default';
  }

  function pack(raw) {
    const id = resolveId(raw);
    const packs = root.MermaidStatePacks || {};
    return packs[id] || packs.default || null;
  }

  function variables(raw) {
    const p = pack(raw);
    if (!p) return { background: 'transparent' };
    return Object.assign({}, p.themeVariables, {
      fontFamily: p.fontFamily,
      fontSize: '14px',
    });
  }

  return { resolveId: resolveId, pack: pack, variables: variables, ids: IDS.slice() };
});
