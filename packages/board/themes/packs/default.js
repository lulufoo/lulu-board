/* Board theme pack: default. Color and chrome only — sizes live in themes/type-scale.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardThemePacks = root.BoardThemePacks || {};
  root.BoardThemePacks.default = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    id: 'default',
    label: 'Default',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
    color: '#222',
    edgeStroke: '#2563eb',
    edgeEvidence: '#aaaaaa',
    edgeFeedback: '#888888',
    bandBg: '#f5f5f5',
    bandBorder: '#bbb',
    swatches: [
      { bg: '#ffffff', border: '#bbbbbb', item: '#ffffff' },
      { bg: '#f7f7f7', border: '#999999', item: '#f5f5f5' },
      { bg: '#ffffff', border: '#888888', item: '#fafafa' },
      { bg: '#f3f3f3', border: '#777777', item: '#eeeeee' },
      { bg: '#ffffff', border: '#666666', item: '#f7f7f7' },
      { bg: '#f9f9f9', border: '#555555', item: '#f0f0f0' },
    ],
    typePartials: {
      card: { radius: '6px', titleColor: '#222', titleWeight: '650' },
      layout: { shell: 'hollow', pad: '0' },
      container: { shell: 'outline', borderStyle: 'dashed', pad: '16px' },
    },
  };
});
