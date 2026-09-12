/**
 * Mindmap theme adapter — source of truth: vendor/mermaid-themes/mindmap
 * (runtime: MermaidMindmapThemes from mermaid-themes.min.js).
 */
export function normalizeTheme(id) {
  if (typeof MermaidMindmapThemes !== "undefined" && MermaidMindmapThemes.resolveId) {
    return MermaidMindmapThemes.resolveId(id);
  }
  const t = String(id || "default").toLowerCase();
  return ["default", "classic", "pastel", "kami"].indexOf(t) >= 0 ? t : "default";
}

export function themePalette(id) {
  if (typeof MermaidMindmapThemes !== "undefined" && MermaidMindmapThemes.palette) {
    return MermaidMindmapThemes.palette(id);
  }
  // Fallback when mermaid-themes.min.js is not loaded (unit tests / isolated bundle).
  return {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
    root: { fill: '#f7f7f7', stroke: '#888888', text: '#222222' },
    sections: [{ fill: '#ffffff', stroke: '#bbbbbb', text: '#222222' }],
    edges: ['#2563eb', '#aaaaaa'],
  };
}
