/* Box chrome for the pastel palette. Colors live in packages/board-themes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardTypePartials = root.BoardTypePartials || {};
  root.BoardTypePartials.pastel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    card: { radius: '6px', titleColor: '#1e293b', titleWeight: '650', cardColor: '#334155' },
    layout: { shell: 'hollow', pad: '0' },
    container: { shell: 'outline', borderStyle: 'dashed', pad: '16px' },
  };
});
