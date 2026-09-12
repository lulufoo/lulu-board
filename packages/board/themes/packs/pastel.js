/* Board theme pack: pastel. Color and chrome only — sizes live in themes/type-scale.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardThemePacks = root.BoardThemePacks || {};
  root.BoardThemePacks.pastel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    id: 'pastel',
    label: 'Pastel',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
    color: '#1e293b',
    edgeStroke: '#64748b',
    edgeEvidence: '#94a3b8',
    edgeFeedback: '#f43f5e',
    bandBg: '#f8fafc',
    bandBorder: '#cbd5e1',
    swatches: [
      { bg: '#eff6ff', border: '#60a5fa', item: '#dbeafe' },
      { bg: '#ecfdf5', border: '#34d399', item: '#d1fae5' },
      { bg: '#fffbeb', border: '#fbbf24', item: '#fef3c7' },
      { bg: '#faf5ff', border: '#c084fc', item: '#f3e8ff' },
      { bg: '#fff7ed', border: '#fb923c', item: '#ffedd5' },
      { bg: '#fdf2f8', border: '#f472b6', item: '#fce7f3' },
      { bg: '#f0fdfa', border: '#2dd4bf', item: '#ccfbf1' },
      { bg: '#f8fafc', border: '#94a3b8', item: '#f1f5f9' },
    ],
    typePartials: {
      // Spacing matches default/classic; only colors differ
      card: { radius: '6px', titleColor: '#1e293b', titleWeight: '650', cardColor: '#334155' },
      layout: { shell: 'hollow', pad: '0' },
      container: { shell: 'outline', borderStyle: 'dashed', pad: '16px' },
    },
  };
});
