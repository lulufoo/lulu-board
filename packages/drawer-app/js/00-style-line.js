(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerStyleLine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var RENDERER_STYLE_RE = /^style\s+(\S+)\s*$/i;

  function isRendererStyleLine(line) {
    return RENDERER_STYLE_RE.test(String(line || "").trim());
  }

  function firstRealLine(body) {
    var lines = String(body == null ? "" : body).split(/\r?\n/);
    for (var i = 0; i < lines.length; i += 1) {
      var line = String(lines[i] || "").trim();
      if (!line || line.charAt(0) === "#" || line.indexOf("//") === 0) continue;
      return line;
    }
    return "";
  }

  function bodyIsBoard(body) {
    return /^board\s+/i.test(firstRealLine(body));
  }

  function splitRendererStyle(body) {
    var lines = String(body == null ? "" : body).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var token = "";
    var out = [];
    for (var i = 0; i < lines.length; i += 1) {
      var trim = String(lines[i] || "").trim();
      if (!token) {
        var hit = RENDERER_STYLE_RE.exec(trim);
        if (hit) {
          token = hit[1];
          continue;
        }
      }
      out.push(lines[i]);
    }
    return { token: token, body: out.join("\n") };
  }

  function joinRendererStyle(token, body) {
    var rest = String(body == null ? "" : body);
    var t = String(token || "").trim();
    if (!t) return rest;
    var line = "style " + t;
    if (!rest) return line + "\n";
    if (rest.charAt(0) === "\n") return line + rest;
    return line + "\n" + rest;
  }

  // Camera viewport: world point at the stage centre + zoom.
  // Legacy {scale, x, y} pan-pixel viewports are not a camera and read as null.
  function authoredViewport(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var scale = Number(raw.scale);
    var cx = Number(raw.cx);
    var cy = Number(raw.cy);
    if (!isFinite(scale) || !isFinite(cx) || !isFinite(cy)) return null;
    return {
      scale: Math.min(3, Math.max(0.2, scale)),
      cx: Math.round(cx),
      cy: Math.round(cy),
    };
  }

  return {
    RENDERER_STYLE_RE: RENDERER_STYLE_RE,
    isRendererStyleLine: isRendererStyleLine,
    bodyIsBoard: bodyIsBoard,
    splitRendererStyle: splitRendererStyle,
    joinRendererStyle: joinRendererStyle,
    authoredViewport: authoredViewport,
  };
});
