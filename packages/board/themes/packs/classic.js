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
    color: '#333',
    edgeStroke: '#9370db',
    edgeEvidence: '#999999',
    edgeFeedback: '#c62828',
    bandBg: '#f5f5f5',
    bandBorder: '#999',
    edgeRgb: '98, 74, 160',
    // Fills in rotation order (see themes/rotation.js).
    colors: ['#ececff', '#e3dffc', '#f3e5f5', '#ede7f6', '#e8eaf6', '#f5f3ff', '#faf5ff', '#eef2ff'],
    typePartials: {
      card: {},
      layout: { shell: 'hollow', pad: '0' },
      container: { shell: 'outline', borderStyle: 'dashed', pad: '16px' },
    },
  };
});
