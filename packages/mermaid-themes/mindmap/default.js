/* Mindmap color pack: default — aligned with Board theme pack default (gray chrome + blue edges). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidMindmapPacks = root.MermaidMindmapPacks || {};
  root.MermaidMindmapPacks.default = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    id: 'default',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
    root: {
      fill: '#f7f7f7',
      stroke: '#888888',
      text: '#222222',
    },
    sections: [
      { fill: '#ffffff', stroke: '#bbbbbb', text: '#222222' },
      { fill: '#f7f7f7', stroke: '#999999', text: '#222222' },
      { fill: '#ffffff', stroke: '#888888', text: '#222222' },
      { fill: '#f3f3f3', stroke: '#777777', text: '#222222' },
      { fill: '#ffffff', stroke: '#666666', text: '#222222' },
      { fill: '#f9f9f9', stroke: '#555555', text: '#222222' },
    ],
    edges: [
      '#2563eb',
      '#aaaaaa',
      '#888888',
      '#777777',
      '#666666',
      '#555555',
    ],
  };
});
