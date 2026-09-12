/* Sequence theme packs API — mirrors MermaidFlowchartThemes. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidSequenceThemes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const IDS = ['default', 'classic', 'pastel', 'kami'];

  function resolveId(raw) {
    const id = String(raw || '').trim().toLowerCase();
    return IDS.indexOf(id) >= 0 ? id : 'default';
  }

  function pack(raw) {
    const id = resolveId(raw);
    const packs = root.MermaidSequencePacks || {};
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

  function frameColors(raw) {
    const p = pack(raw);
    if (p && p.frame) return { solid: p.frame.solid, dashed: p.frame.dashed };
    return { solid: '#8a8a8e', dashed: '#5c5c60' };
  }

  return { resolveId: resolveId, pack: pack, variables: variables, frameColors: frameColors, ids: IDS.slice() };
});
