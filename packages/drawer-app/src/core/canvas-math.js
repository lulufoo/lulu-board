/* Pure camera math. Boot/DOM stays in leftover js/00-canvas-view.js. */
import { authoredViewport } from '../../../board-core/style-token.js';

export function normalizeDocumentView(raw) {
  return authoredViewport(raw);
}

export function cameraToPan(cam, stage, origin) {
  return {
    x: stage.w / 2 - (cam.cx + origin.x) * cam.scale,
    y: stage.h / 2 - (cam.cy + origin.y) * cam.scale,
  };
}

export function panToCamera(panX0, panY0, scale0, stage, origin) {
  if (!(scale0 > 0)) return null;
  return {
    scale: scale0,
    cx: (stage.w / 2 - panX0) / scale0 - origin.x,
    cy: (stage.h / 2 - panY0) / scale0 - origin.y,
  };
}
