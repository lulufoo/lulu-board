/* Drawer mermaid theme packs. Flowchart API below; mindmap/sequence packs load as MermaidMindmapThemes / MermaidSequenceThemes. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidFlowchartThemes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const IDS = ['default', 'classic', 'pastel', 'kami'];

  function resolveId(raw) {
    const id = String(raw || '').trim();
    return IDS.indexOf(id) >= 0 ? id : 'default';
  }

  function pack(raw) {
    const id = resolveId(raw);
    const packs = root.MermaidFlowchartPacks || {};
    return packs[id] || packs.default || null;
  }

  function variables(raw) {
    const p = pack(raw);
    const scale = root.MermaidFlowchartScale && root.MermaidFlowchartScale.get
      ? root.MermaidFlowchartScale.get()
      : { fontSize: '14px' };
    if (!p) return { fontSize: scale.fontSize };
    const vars = Object.assign({}, p.themeVariables, {
      fontFamily: p.fontFamily,
      fontSize: scale.fontSize,
    });
    return vars;
  }

  return { resolveId: resolveId, pack: pack, variables: variables };
});
