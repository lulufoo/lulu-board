/* Mindmap color pack: classic. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidMindmapPacks = root.MermaidMindmapPacks || {};
  root.MermaidMindmapPacks.classic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
  "id": "classic",
  "fontFamily": "\"Trebuchet MS\", Verdana, Arial, sans-serif",
  "root": {
    "fill": "#4a148c",
    "stroke": "#311b92",
    "text": "#f5f3ff"
  },
  "sections": [
    {
      "fill": "#ececff",
      "stroke": "#9370db",
      "text": "#333333"
    },
    {
      "fill": "#e8e4ff",
      "stroke": "#8b5cf6",
      "text": "#4a148c"
    },
    {
      "fill": "#f3e5f5",
      "stroke": "#ce93d8",
      "text": "#6a1b9a"
    },
    {
      "fill": "#fce4ec",
      "stroke": "#f48fb1",
      "text": "#880e4f"
    },
    {
      "fill": "#e3f2fd",
      "stroke": "#90caf9",
      "text": "#0d47a1"
    },
    {
      "fill": "#f5f3ff",
      "stroke": "#c4b5fd",
      "text": "#5b21b6"
    }
  ],
  "edges": [
    "#7e57c2",
    "#9370db",
    "#8b5cf6",
    "#ab47bc",
    "#5c6bc0",
    "#7e57c2"
  ]
};
});
