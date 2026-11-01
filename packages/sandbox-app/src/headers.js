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

/* The path pattern that carries the CSP: the whole domain. */
export const RUNNER_PATHS = Object.freeze(['/*']);

/* The page changes only when the core changes, so it is cached briefly and revalidated in the background.
 * capture-<hash>.js is named by its content and never changes. */
export const RUNNER_CACHE = Object.freeze({
  '/': 'public, max-age=60, stale-while-revalidate=86400',
  '/capture-*': 'public, max-age=31536000, immutable',
});

/* Cloudflare Workers static assets `_headers` file. One catch-all block carries the CSP, so a future page
 * on this domain gets it too; the cache rules add to it. */
export function runnerHeadersFile(frameAncestors) {
  var headers = runnerHeaders(frameAncestors);
  var lines = ['/*'];
  Object.keys(headers).forEach(function (name) { lines.push('  ' + name + ': ' + headers[name]); });
  lines.push('');
  Object.keys(RUNNER_CACHE).forEach(function (p) {
    lines.push(p, '  Cache-Control: ' + RUNNER_CACHE[p], '');
  });
  return lines.join('\n');
}
