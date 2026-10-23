/* Shared palette pack: pastel. Box chrome lives in packages/board. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardPalettePacks = root.BoardPalettePacks || {};
  root.BoardPalettePacks.pastel = api;
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
    colors: ['#eff6ff', '#ecfdf5', '#fffbeb', '#faf5ff', '#fff7ed', '#fdf2f8', '#f0fdfa', '#f8fafc'],
  };
});
