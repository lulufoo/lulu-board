/* Mindmap color pack: kami. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidMindmapPacks = root.MermaidMindmapPacks || {};
  root.MermaidMindmapPacks.kami = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
  "id": "kami",
  "fontFamily": "\"Songti SC\", \"STSong\", \"Source Han Serif SC\", \"Noto Serif CJK SC\", Palatino, Georgia, serif",
  "root": {
    "fill": "#1B365D",
    "stroke": "#141413",
    "text": "#faf9f5"
  },
  "sections": [
    {
      "fill": "#faf9f5",
      "stroke": "#6b6a64",
      "text": "#141413"
    },
    {
      "fill": "#ebe6d6",
      "stroke": "#8a8778",
      "text": "#141413"
    },
    {
      "fill": "#f5f4ed",
      "stroke": "#6b6a64",
      "text": "#1B365D"
    },
    {
      "fill": "#f0ebe0",
      "stroke": "#8a8778",
      "text": "#141413"
    },
    {
      "fill": "#e8eef5",
      "stroke": "#1B365D",
      "text": "#1B365D"
    },
    {
      "fill": "#f5f4ed",
      "stroke": "#6b6a64",
      "text": "#141413"
    }
  ],
  "edges": [
    "#1B365D",
    "#6b6a64",
    "#1B365D",
    "#8a8778",
    "#4a5568",
    "#1B365D"
  ]
};
});
