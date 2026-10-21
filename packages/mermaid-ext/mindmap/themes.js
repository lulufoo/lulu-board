/** Map Board / Pele theme ids onto a mindmap palette. Does not load mermaid-themes. */

const IDS = ["default", "classic", "pastel"];
const FALLBACK_FONT = '"SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif';

export function normalizeTheme(id) {
  const raw = String(id || "default").trim().toLowerCase();
  if (raw === "minimal") return "classic";
  if (raw === "slate") return "pastel";
  return IDS.indexOf(raw) >= 0 ? raw : "default";
}

function boardTheme(id) {
  const Themes = typeof BoardThemes !== "undefined" ? BoardThemes : null;
  if (Themes && typeof Themes.get === "function") return Themes.get(id);
  return null;
}

function edgeTintOf(theme) {
  const Themes = typeof BoardThemes !== "undefined" ? BoardThemes : null;
  if (Themes && typeof Themes.edgeTint === "function") return Themes.edgeTint(theme);
  return "rgba(74, 53, 36, .14)";
}

export function themePalette(id) {
  const tid = normalizeTheme(id);
  const theme = boardTheme(tid);
  const colors = theme && Array.isArray(theme.colors) ? theme.colors.slice() : ["#fffdf9"];
  const color = (theme && theme.color) || "#4a3524";
  const edge = (theme && theme.edgeStroke) || "#7a5c3c";
  const surface = colors[0] || "#fffdf9";
  const border = theme ? edgeTintOf(theme) : "rgba(74, 53, 36, .14)";
  const sections = colors.map((fill) => ({ fill, stroke: border, text: color }));
  return {
    fontFamily: (theme && theme.fontFamily) || FALLBACK_FONT,
    root: { fill: surface, stroke: border, text: color },
    sections,
    edges: [edge],
  };
}
