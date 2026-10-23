/* Box chrome for the default palette. Colors live in packages/board-themes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardTypePartials = root.BoardTypePartials || {};
  root.BoardTypePartials.default = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    card: { radius: '12px', titleColor: '#4a3524', titleWeight: '650', cardColor: '#4a3524' },
    layout: { shell: 'hollow', pad: '0' },
    container: { shell: 'outline', borderStyle: 'dashed', pad: '16px', titleColor: '#7a6650', titleWeight: '600', cardColor: '#4a3524' },
  };
});
