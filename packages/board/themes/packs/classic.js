/* Board theme pack: classic. Color and chrome only — sizes live in themes/type-scale.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardThemePacks = root.BoardThemePacks || {};
  root.BoardThemePacks.classic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    id: 'classic',
    label: 'Classic',
    fontFamily: '"Trebuchet MS", Verdana, Arial, sans-serif',
    color: '#333',
    edgeStroke: '#9370db',
    edgeEvidence: '#999999',
    edgeFeedback: '#c62828',
    bandBg: '#f5f5f5',
    bandBorder: '#999',
    swatches: [
      { bg: '#ececff', border: '#9370db', item: '#e8e4ff' },
      { bg: '#e3dffc', border: '#7e57c2', item: '#ddd6fe' },
      { bg: '#f3e5f5', border: '#9c27b0', item: '#f3e8ff' },
      { bg: '#ede7f6', border: '#5e35b1', item: '#e9d5ff' },
      { bg: '#e8eaf6', border: '#5c6bc0', item: '#e0e7ff' },
      { bg: '#f5f3ff', border: '#8b5cf6', item: '#ede9fe' },
      { bg: '#faf5ff', border: '#a855f7', item: '#f3e8ff' },
      { bg: '#eef2ff', border: '#6366f1', item: '#e0e7ff' },
    ],
    typePartials: {
      card: {},
      layout: { shell: 'hollow', pad: '0' },
      container: { shell: 'outline', borderStyle: 'dashed', pad: '16px' },
    },
  };
});
