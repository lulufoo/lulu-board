/* Mindmap color pack: pastel. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidMindmapPacks = root.MermaidMindmapPacks || {};
  root.MermaidMindmapPacks.pastel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
  "id": "pastel",
  "fontFamily": "Inter, \"SF Pro Text\", system-ui, sans-serif",
  "root": {
    "fill": "#334155",
    "stroke": "#1e293b",
    "text": "#f8fafc"
  },
  "sections": [
    {
      "fill": "#eff6ff",
      "stroke": "#93c5fd",
      "text": "#1e3a8a"
    },
    {
      "fill": "#ecfdf5",
      "stroke": "#6ee7b7",
      "text": "#065f46"
    },
    {
      "fill": "#fff7ed",
      "stroke": "#fdba74",
      "text": "#9a3412"
    },
    {
      "fill": "#fdf2f8",
      "stroke": "#f9a8d4",
      "text": "#9d174d"
    },
    {
      "fill": "#f0f9ff",
      "stroke": "#7dd3fc",
      "text": "#075985"
    },
    {
      "fill": "#f5f3ff",
      "stroke": "#c4b5fd",
      "text": "#5b21b6"
    }
  ],
  "edges": [
    "#64748b",
    "#60a5fa",
    "#34d399",
    "#fb923c",
    "#f472b6",
    "#38bdf8"
  ]
};
});
