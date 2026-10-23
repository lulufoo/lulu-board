/* Shared palette pack: default. Box chrome lives in packages/boxes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardPalettePacks = root.BoardPalettePacks || {};
  root.BoardPalettePacks.default = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    id: 'default',
    label: 'Default',
    color: '#4a3524',
    edgeStroke: '#7a5c3c',
    edgeLabel: '#5a4330',
    edgeEvidence: '#aaaaaa',
    edgeFeedback: '#888888',
    bandBg: '#f5f5f5',
    bandBorder: '#bbb',
    edgeRgb: '74, 53, 36',
    colors: ['#fffdf9', '#f8efe0', '#fdeee3', '#f2f3e4', '#faebe6', '#ecf1e6', '#f3ece6', '#efe9d8'],
  };
});
