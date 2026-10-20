(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerPeleTheme = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function themeOf(themeOrId) {
    if (themeOrId && typeof themeOrId === "object" && !Array.isArray(themeOrId) && themeOrId.colors) {
      return themeOrId;
    }
    var Themes = typeof BoardThemes !== "undefined" ? BoardThemes : null;
    if (Themes && typeof Themes.get === "function") return Themes.get(themeOrId);
    return null;
  }

  function mapPack(themeOrId) {
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
    var border = theme.bandBorder || color;
    var surface = colors[0] || "#fffdf9";
    var alt = colors[6] || colors[1] || surface;
    var radius = (theme.types && theme.types.card && theme.types.card.radius) || "12px";
    var css = {
      "--pele-bg": "transparent",
      "--pele-fg": color,
      "--pele-muted": muted,
      "--pele-line": edge,
      "--pele-surface": surface,
      "--pele-surface-alt": alt,
      "--pele-border": border,
      "--pele-accent": edge,
      "--pele-font": theme.fontFamily || '"SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif',
      "--pele-radius": radius,
    };
    var i;
    for (i = 0; i < colors.length && i < 8; i += 1) {
      css["--pele-series-" + (i + 1)] = colors[i];
    }
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
        clusterBkg: alt,
        clusterBorder: border,
        titleColor: color,
        nodeTextColor: color,
        edgeLabelBackground: surface,
        textColor: color,
      },
    };
  }

  function applyTo(hosts, themeOrId) {
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

  return {
    mapPack: mapPack,
    applyTo: applyTo,
  };
});
