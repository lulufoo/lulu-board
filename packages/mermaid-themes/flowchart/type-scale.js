/* Flowchart type scale — one size for all four flowchart color packs. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidFlowchartScale = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCALE = { fontSize: '14px' };
  return { SCALE, get: function () { return SCALE; } };
});
