/* drawer-app/00-sentry-count.js — metrics.count helper. No-op when Sentry did not init. */
function sentryCount(name) {
  var S = window.Sentry;
  if (!S || !S.metrics || typeof S.metrics.count !== "function") return;
  if (!name) return;
  S.metrics.count(name, 1);
}

(function countCanvasView() {
  if (/^\/landing\/?$/.test(location.pathname)) return;
  sentryCount("canvas.view");
})();
