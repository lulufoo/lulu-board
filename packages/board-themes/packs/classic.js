/* Shared palette pack: classic. Box chrome lives in packages/boxes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardPalettePacks = root.BoardPalettePacks || {};
  root.BoardPalettePacks.classic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    id: 'classic',
    label: 'Classic',
    color: '#333',
    edgeStroke: '#9370db',
    edgeEvidence: '#999999',
    edgeFeedback: '#c62828',
    bandBg: '#f5f5f5',
    bandBorder: '#999',
    edgeRgb: '98, 74, 160',
    colors: ['#ececff', '#e3dffc', '#f3e5f5', '#ede7f6', '#e8eaf6', '#f5f3ff', '#faf5ff', '#eef2ff'],
  };
});
