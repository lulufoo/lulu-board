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

  return {
    SCALE: SCALE,
    STEP_MIN: STEP_MIN,
    STEP_MAX: STEP_MAX,
    FACTOR: FACTOR,
    MIN_PX: MIN_PX,
    clampStep: clampStep,
    factor: factor,
    px: px,
  };
});
