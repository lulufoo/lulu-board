/* Response headers for the runner page. The whole sandbox domain is the runner, so they apply to every path.
 * CSP must be a header: `sandbox` and `frame-ancestors` do nothing in a <meta> tag.
 * Not covered on purpose: script-src, img-src, style-src. Sketch scripts and styles must run,
 * and image GETs can still leak data; connect-src only closes fetch, XHR, WebSocket, and beacon. */

export const RUNNER_FRAME_ANCESTORS = Object.freeze(['https://luluboard.app']);

export function runnerCsp(frameAncestors) {
  var ancestors = frameAncestors && frameAncestors.length ? frameAncestors : RUNNER_FRAME_ANCESTORS;
  return [
    // Opaque origin even when the page is opened outside Board's iframe; scripts may run, nothing else.
    'sandbox allow-scripts',
    // Scripts cannot send data out through fetch, XHR, WebSocket, or beacon.
    "connect-src 'none'",
    // Only Board may embed the runner.
    'frame-ancestors ' + ancestors.join(' '),
    // Scripts cannot create nested documents or plugins to get around connect-src.
    "frame-src 'none'",
    "object-src 'none'",
  ].join('; ');
}

export function runnerHeaders(frameAncestors) {
  return { 'Content-Security-Policy': runnerCsp(frameAncestors) };
}

/* One catch-all block: a future page on this domain gets the CSP too. */
export const RUNNER_PATHS = Object.freeze(['/*']);

/* Cloudflare Workers static assets `_headers` file. */
export function runnerHeadersFile(frameAncestors) {
  var headers = runnerHeaders(frameAncestors);
  var lines = [];
  RUNNER_PATHS.forEach(function (p) {
    lines.push(p);
    Object.keys(headers).forEach(function (name) { lines.push('  ' + name + ': ' + headers[name]); });
    lines.push('');
  });
  return lines.join('\n');
}
