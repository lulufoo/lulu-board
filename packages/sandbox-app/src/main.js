/* Runner page entry: the small core, inlined into index.html so rendering waits for nothing but the page itself.
 * SnapDOM is only needed to export, so it lives in capture.js and loads on demand. */
import { createRunner } from './runner.js';

var capturePromise = null;

function loadCapture() {
  if (!capturePromise) {
    capturePromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      // A classic script: an opaque-origin page loads it without CORS.
      script.src = window.LuluCaptureSrc;
      script.onload = function () {
        if (window.LuluSnapdom) resolve(window.LuluSnapdom);
        else reject(new Error('capture script missing'));
      };
      script.onerror = function () {
        capturePromise = null;
        reject(new Error('capture script failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return capturePromise;
}

createRunner({
  window: window,
  document: document,
  toCanvas: function (el, opts) {
    return loadCapture().then(function (snapdom) { return snapdom.toCanvas(el, opts); });
  },
  createImageBitmap: function (canvas) { return window.createImageBitmap(canvas); },
  ResizeObserver: window.ResizeObserver,
}).start();

// Warm the capture script once the page is up, so the first export does not wait for it.
window.addEventListener('load', function () { setTimeout(function () { loadCapture().catch(function () {}); }, 0); });
