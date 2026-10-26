/* Pele host mapping. */
import * as BoxesThemes from '../../../boxes/themes/index.js';

const PELE_FONT = '"SF Pro Text", "SF Pro Display", Inter, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif';
const EDGE_RGB_FALLBACK = "74, 53, 36";

function themeOf(themeOrId) {
  if (themeOrId && typeof themeOrId === "object" && !Array.isArray(themeOrId) && themeOrId.colors) {
    return themeOrId;
  }
  var Themes = typeof BoxesThemes !== "undefined" ? BoxesThemes : null;
  if (Themes && typeof Themes.get === "function") return Themes.get(themeOrId);
  return null;
}

function bakeDefaultRectRadius(rect, n) {
  if (!rect || !rect.setAttribute) return;
  rect.setAttribute("rx", String(n));
  rect.setAttribute("ry", String(n));
}

export function mapPack(themeOrId) {
  var theme = themeOf(themeOrId);
  if (!theme) {
    return {
      css: {},
      themeVariables: {},
      series: [],
    };
  }
  var colors = Array.isArray(theme.colors) ? theme.colors.slice() : [];
  var color = theme.color || "#4a3524";
  var edge = theme.edgeStroke || color;
  var muted = theme.edgeLabel || color;
  var surface = colors[0] || "#fffdf9";
  var alt = colors[6] || colors[1] || surface;
  var Themes = typeof BoxesThemes !== "undefined" ? BoxesThemes : null;
  var border = Themes && typeof Themes.strokeFromFill === "function"
    ? Themes.strokeFromFill("var(--pele-surface)")
    : "color-mix(in srgb, var(--pele-surface) 90%, rgb(var(--bf-rgb, 74, 53, 36)))";
  var clusterBorder = border;
  var radiusPx = Themes && isFinite(Themes.BOX_RX) ? Themes.BOX_RX : 4;
  var radius = String(radiusPx) + "px";
  var css = {
    "--bf-rgb": theme.edgeRgb || EDGE_RGB_FALLBACK,
    "--pele-bg": "transparent",
    "--pele-fg": color,
    "--pele-muted": muted,
    "--pele-line": edge,
    "--pele-surface": surface,
    "--pele-surface-alt": alt,
    "--pele-border": border,
    "--pele-accent": edge,
    "--pele-font": theme.fontFamily || PELE_FONT,
    "--pele-radius": radius,
  };
  var i;
  for (i = 0; i < colors.length && i < 8; i += 1) {
    css["--pele-series-" + (i + 1)] = colors[i];
  }
  css["--_bg"] = "var(--pele-bg, #fff)";
  css["--_fg"] = "var(--pele-fg, #1f1f1f)";
  css["--_m"] = "var(--pele-muted, #6e6e6e)";
  css["--_l"] = "var(--pele-line, #1f1f1f)";
  css["--_s"] = "var(--pele-surface, #f3f3f3)";
  css["--_a"] = "var(--pele-surface-alt, #e6e6e6)";
  css["--_b"] = "var(--pele-border, color-mix(in srgb, var(--pele-surface) 90%, rgb(var(--bf-rgb, 74, 53, 36))))";
  css["--_c"] = "var(--pele-accent)";
  css["--_r"] = "var(--pele-radius)";
  return {
    css: css,
    series: colors,
    themeVariables: {
      background: "transparent",
      primaryColor: surface,
      primaryTextColor: color,
      primaryBorderColor: border,
      lineColor: edge,
      secondaryColor: colors[1] || surface,
      tertiaryColor: colors[2] || alt,
      tertiaryTextColor: muted,
      clusterBkg: surface,
      clusterBorder: clusterBorder,
      titleColor: color,
      nodeTextColor: color,
      edgeLabelBackground: surface,
      textColor: color,
    },
  };
}

export function polishBoxes(root) {
  if (!root || !root.querySelectorAll) return;
  var Themes = typeof BoxesThemes !== "undefined" ? BoxesThemes : null;
  var rx = Themes && isFinite(Themes.BOX_RX) ? Themes.BOX_RX : 4;
  root.querySelectorAll("g.pele-node > rect, g.pele-cluster > rect").forEach(function (rect) {
    var cls = String(rect.getAttribute("class") || "");
    if (cls.indexOf("canvas-hover-halo") >= 0 || cls.indexOf("flowchart-selection-halo") >= 0) return;
    bakeDefaultRectRadius(rect, rx);
  });
}

export function applyTo(hosts, themeOrId) {
  var mapped = mapPack(themeOrId);
  var list = Array.isArray(hosts) ? hosts : [hosts];
  list.forEach(function (host) {
    if (!host || !host.style) return;
    Object.keys(mapped.css).forEach(function (key) {
      host.style.setProperty(key, mapped.css[key]);
    });
  });
  return mapped;
}

const DrawerPeleTheme = {
  mapPack: mapPack,
  applyTo: applyTo,
  polishBoxes: polishBoxes,
};

export default DrawerPeleTheme;
