/* Mindmap theme packs API — mirrors MermaidFlowchartThemes. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidMindmapThemes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const IDS = ['default', 'classic', 'pastel', 'kami'];

  function resolveId(raw) {
    const id = String(raw || '').trim().toLowerCase();
    return IDS.indexOf(id) >= 0 ? id : 'default';
  }

  function pack(raw) {
    const id = resolveId(raw);
    const packs = root.MermaidMindmapPacks || {};
    return packs[id] || packs.default || null;
  }

  /** Palette used by mermaid-ext/mindmap draw. */
  function palette(raw) {
    const p = pack(raw);
    if (!p) {
      return {
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
        root: { fill: '#f7f7f7', stroke: '#888888', text: '#222222' },
        sections: [],
        edges: ['#2563eb'],
      };
    }
    return {
      fontFamily: p.fontFamily,
      root: p.root,
      sections: p.sections || [],
      edges: p.edges || [],
    };
  }

  return { resolveId: resolveId, pack: pack, palette: palette, ids: IDS.slice() };
});
