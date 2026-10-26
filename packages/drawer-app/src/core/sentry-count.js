/* drawer-app metrics.count helper. No-op when Sentry did not init. */
export function sentryCount(name) {
  var S = typeof window !== "undefined" ? window.Sentry : null;
  if (!S || !S.metrics || typeof S.metrics.count !== "function") return;
  if (!name) return;
  S.metrics.count(name, 1);
}

export function countCanvasView() {
  if (typeof location === "undefined") return;
  if (/^\/landing\/?$/.test(location.pathname)) return;
  sentryCount("canvas.view");
}

countCanvasView();
