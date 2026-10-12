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
    color: '#1e293b',
    edgeStroke: '#64748b',
    edgeEvidence: '#94a3b8',
    edgeFeedback: '#f43f5e',
    bandBg: '#f8fafc',
    bandBorder: '#cbd5e1',
    edgeRgb: '71, 85, 105',
    // Fills in rotation order (see themes/rotation.js).
    colors: ['#eff6ff', '#ecfdf5', '#fffbeb', '#faf5ff', '#fff7ed', '#fdf2f8', '#f0fdfa', '#f8fafc'],
    typePartials: {
      // Spacing matches default/classic; only colors differ
      card: { radius: '6px', titleColor: '#1e293b', titleWeight: '650', cardColor: '#334155' },
      layout: { shell: 'hollow', pad: '0' },
      container: { shell: 'outline', borderStyle: 'dashed', pad: '16px' },
    },
  };
});
