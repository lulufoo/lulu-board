/** Map Board / Pele theme ids onto a mindmap palette. Does not load mermaid-themes. */
import { APPEARANCES, edgeTint, get, resolveId } from '../../board-themes/index.js';

const FALLBACK_FONT = '"SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif';

export function normalizeTheme(id) {
  const raw = String(id == null || id === '' ? 'light' : id).trim().toLowerCase();
  if (APPEARANCES[raw]) return raw;
  return resolveId(raw);
}

export function themePalette(id) {
  const tid = normalizeTheme(id);
  const theme = get(tid);
  const colors = theme && Array.isArray(theme.colors) ? theme.colors.slice() : ['#fffdf9'];
  const color = (theme && theme.color) || '#4a3524';
  const edge = (theme && theme.edgeStroke) || '#7a5c3c';
  const surface = colors[0] || '#fffdf9';
  const border = theme ? edgeTint(theme) : 'rgba(74, 53, 36, .14)';
  const sections = colors.map((fill) => ({ fill, stroke: border, text: color }));
  return {
    fontFamily: (theme && theme.fontFamily) || FALLBACK_FONT,
    root: { fill: surface, stroke: color, text: color },
    sections,
    edges: [edge],
  };
}
