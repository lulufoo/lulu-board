/* drawer-app metrics.count helper. No-op when Sentry did not init. */
export function sentryCount(name) {
  var S = typeof window !== "undefined" ? window.Sentry : null;
  if (!S || !S.metrics || typeof S.metrics.count !== "function") return;
  if (!name) return;
  S.metrics.count(name, 1);
}

export function utf8ByteLength(text) {
  var value = String(text || "");
  if (typeof TextEncoder !== "function") return value.length;
  return new TextEncoder().encode(value).length;
}

export function diagramFetchRequestBytes(url, authorizationValue) {
  return utf8ByteLength(url) + utf8ByteLength("Authorization: " + String(authorizationValue || ""));
}

export function diagramFetchWireBytes(url) {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") return 0;
  var entries = performance.getEntriesByType("resource") || [];
  var match = null;
  for (var i = 0; i < entries.length; i += 1) {
    if (entries[i] && entries[i].name === url) match = entries[i];
  }
  var size = match ? Number(match.encodedBodySize) : 0;
  return Number.isFinite(size) && size > 0 ? size : 0;
}

export function recordDiagramFetch(traceId, started, attributes) {
  var S = typeof window !== "undefined" ? window.Sentry : null;
  if (!S || typeof S.startSpan !== "function") return;
  var id = String(traceId || "");
  var fields = attributes || {};
  if (!id) return;
  var spanAttributes = {
    "diagram.fetch.id": id,
    "diagram.fetch.request_bytes": Number(fields.requestBytes) || 0,
    "diagram.fetch.response_bytes": Number(fields.responseBytes) || 0,
  };
  if (Number(fields.wireBytes) > 0) {
    spanAttributes["diagram.fetch.response_wire_bytes"] = Number(fields.wireBytes);
  }
  S.startSpan({
    name: "diagram.fetch",
    op: "http.client",
    startTime: started,
    attributes: spanAttributes,
  }, function () {});
}

export function countCanvasView() {
  if (typeof location === "undefined") return;
  if (/^\/landing\/?$/.test(location.pathname)) return;
  sentryCount("canvas.view");
}

countCanvasView();
