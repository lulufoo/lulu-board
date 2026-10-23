/* Box chrome for the classic palette. Colors live in packages/board-themes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardTypePartials = root.BoardTypePartials || {};
  root.BoardTypePartials.classic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    card: {},
    layout: { shell: 'hollow', pad: '0' },
    container: { shell: 'outline', borderStyle: 'dashed', pad: '16px' },
  };
});
