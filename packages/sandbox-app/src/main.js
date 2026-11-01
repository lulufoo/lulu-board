/* Runner page entry. Bundled with SnapDOM into one classic script, so the opaque-origin page
 * needs no cross-origin module fetch. */
import { snapdom } from '../../../third_party/snapdom/snapdom.mjs';
import { createRunner } from './runner.js';

createRunner({
  window: window,
  document: document,
  toCanvas: function (el, opts) { return snapdom.toCanvas(el, opts); },
  createImageBitmap: function (canvas) { return window.createImageBitmap(canvas); },
  ResizeObserver: window.ResizeObserver,
}).start();
