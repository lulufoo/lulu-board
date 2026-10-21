(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FlowchartTypeScale = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SCALE = {
    default: 16,
    startEnd: 15,
    judgment: 14,
    link: 13,
  };
  var STEP_MIN = -3;
  var STEP_MAX = 3;
  var FACTOR = 1.125;
  var MIN_PX = 8;

  function clampStep(raw) {
    var n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return 0;
    return Math.min(STEP_MAX, Math.max(STEP_MIN, n));
  }

  function factor(n) {
    return Math.pow(FACTOR, clampStep(n));
  }

  function basePx(rung) {
    var n = SCALE[rung];
    return typeof n === "number" ? n : 0;
  }

  function px(rung, step) {
    return Math.max(MIN_PX, Math.round(basePx(rung) * factor(step)));
  }

  function classOf(el) {
    if (!el) return "";
    if (el.getAttribute) return String(el.getAttribute("class") || "");
    return String(el.className || "");
  }

  function closestClass(el, re) {
    var n = el;
    while (n) {
      if (re.test(classOf(n))) return n;
      n = n.parentNode || n.parentElement || null;
    }
    return null;
  }

  function rungForText(el) {
    if (closestClass(el, /\bpele-edge-label\b/) || closestClass(el, /\bpele-edge\b/)) return "link";
    var node = closestClass(el, /\bpele-node\b/);
    if (!node) return "default";
    var cls = classOf(node);
    if (/\bpele-shape-stadium\b/.test(cls)) return "startEnd";
    if (/\bpele-shape-diam\b/.test(cls)) return "judgment";
    return "default";
  }

  function setCssVar(el, name, value) {
    if (!el) return;
    if (!el.style) el.style = {};
    if (typeof el.style.setProperty === "function") {
      el.style.setProperty(name, value);
      return;
    }
    el.style[name] = value;
  }

  function findSvg(root) {
    if (!root) return null;
    if (root.tagName && String(root.tagName).toLowerCase() === "svg") return root;
    if (typeof root.querySelector === "function") return root.querySelector("svg");
    return null;
  }

  function eachText(root, fn) {
    if (!root) return;
    if (typeof root.querySelectorAll === "function") {
      var list = root.querySelectorAll("text, tspan");
      if (list && list.length) {
        var i;
        for (i = 0; i < list.length; i += 1) fn(list[i]);
        return;
      }
    }
    (function walk(n) {
      var tag = n && n.tagName ? String(n.tagName).toLowerCase() : "";
      if (tag === "text" || tag === "tspan") fn(n);
      var kids = (n && (n.kids || n.children)) || [];
      var k;
      for (k = 0; k < kids.length; k += 1) walk(kids[k]);
    })(root);
  }

  function applyToRoot(root, step) {
    step = clampStep(step);
    if (!root) return;
    var sizes = {
      default: px("default", step),
      startEnd: px("startEnd", step),
      judgment: px("judgment", step),
      link: px("link", step),
    };
    var svg = findSvg(root);
    if (svg) {
      if (typeof svg.setAttribute === "function") svg.setAttribute("data-fc-type-step", String(step));
      setCssVar(svg, "--fc-font-default", sizes.default + "px");
      setCssVar(svg, "--fc-font-start-end", sizes.startEnd + "px");
      setCssVar(svg, "--fc-font-judgment", sizes.judgment + "px");
      setCssVar(svg, "--fc-font-link", sizes.link + "px");
    }
    eachText(root, function (el) {
      if (!el.style) el.style = {};
      el.style.fontSize = sizes[rungForText(el)] + "px";
    });
  }

  return {
    SCALE: SCALE,
    STEP_MIN: STEP_MIN,
    STEP_MAX: STEP_MAX,
    FACTOR: FACTOR,
    MIN_PX: MIN_PX,
    clampStep: clampStep,
    factor: factor,
    px: px,
    rungForText: rungForText,
    applyToRoot: applyToRoot,
  };
});
