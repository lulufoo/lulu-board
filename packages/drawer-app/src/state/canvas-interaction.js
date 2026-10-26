/* Shared canvas gestures. Live camera is imported from shell-state. */
import { emit } from '../core/hooks.js';
import DrawerStyleLine from '../core/style-line.js';
import {
  closePropsPanel,
  openPropsPanel,
  setCanvasZoom,
  setCameraPan,
  applyTransform,
  stageEl,
  scale,
  panX,
  panY,
} from './shell-state.js';

const CHROME_SEL = [
  ".board-inspector",
  ".diagram-dock",
  ".diagram-dock-resize",
  ".shell-account-bar",
  ".props-panel",
  ".top-float",
  ".zoom-float",
  ".menu",
  ".sheet",
  "button",
  "input",
  "select",
  "textarea",
  "label",
].join(", ");

const kinds = Object.create(null);
let boundStage = null;
let panning = false;
let panOrigin = null;
let panMoved = false;

export function registerKind(id, rec) {
  var key = String(id || "").trim();
  if (!key || !rec) return;
  kinds[key] = {
    isHit: typeof rec.isHit === "function" ? rec.isHit : null,
    clear: typeof rec.clear === "function" ? rec.clear : null,
  };
}

export function activeKindId() {
  var html = typeof document !== "undefined" ? document.documentElement : null;
  var kind = html && html.dataset ? html.dataset.kind : "";
  if (kind === "mindmap") return "mindmap";
  if (kind === "flowchart" || kind === "mermaid-unsupported") return "flowchart";
  if (DrawerStyleLine.isDesignKind && DrawerStyleLine.isDesignKind(kind)) {
    return "design";
  }
  return "board";
}

function kindHit(target) {
  var rec = kinds[activeKindId()];
  return !!(rec && rec.isHit && rec.isHit(target));
}

export function isBlockedTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  if (target.closest(CHROME_SEL)) return true;
  return kindHit(target);
}

export function wheelFactor(deltaY, deltaMode) {
  var unit = deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1;
  return Math.exp(-(Number(deltaY) * unit) * 0.0012);
}

function hideBlankProps() {
  closePropsPanel();
}

export function leaveBlank() {
  hideBlankProps();
  var rec = kinds[activeKindId()];
  if (rec && rec.clear) rec.clear();
}

export function openBlankProps() {
  openPropsPanel();
}

function onDblClick(event) {
  if (isBlockedTarget(event.target)) return;
  openBlankProps();
}

function onWheel(event) {
  event.preventDefault();
  var factor = wheelFactor(event.deltaY, event.deltaMode);
  setCanvasZoom(scale * factor);
  emit("noteUserCanvasView");
  emit("flashChrome");
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  if (isBlockedTarget(event.target)) return;
  event.preventDefault();
  try {
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();
  } catch (_e) {}
  panning = true;
  panMoved = false;
  if (boundStage && boundStage.classList) boundStage.classList.add("panning");
  panOrigin = {
    x: event.clientX - panX,
    y: event.clientY - panY,
    startX: event.clientX,
    startY: event.clientY,
  };
  if (boundStage && typeof boundStage.setPointerCapture === "function") {
    boundStage.setPointerCapture(event.pointerId);
  }
}

function onPointerMove(event) {
  if (!panning || !panOrigin) return;
  if (!panMoved && panOrigin.startX != null) {
    var dx0 = event.clientX - panOrigin.startX;
    var dy0 = event.clientY - panOrigin.startY;
    if (dx0 * dx0 + dy0 * dy0 >= 25) panMoved = true;
  }
    setCameraPan(event.clientX - panOrigin.x, event.clientY - panOrigin.y);
    applyTransform();
}

function endPan(leaveIfStill) {
  var wasPanning = panning;
  var moved = panMoved;
  panning = false;
  panOrigin = null;
  panMoved = false;
  if (boundStage && boundStage.classList) boundStage.classList.remove("panning");
  try {
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();
  } catch (_e) {}
  if (wasPanning && moved) emit("noteUserCanvasView");
  if (wasPanning && !moved && leaveIfStill) leaveBlank();
}

function onPointerUp() {
  endPan(true);
}

function onPointerCancel() {
  endPan(false);
}

function onSelectStart(event) {
  if (panning) event.preventDefault();
}

export function bind(stage) {
  if (!stage || boundStage === stage) return;
  boundStage = stage;
  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerCancel);
  stage.addEventListener("selectstart", onSelectStart);
  stage.addEventListener("dblclick", onDblClick);
}

export const Canvas = {
  CHROME_SEL: CHROME_SEL,
  registerKind: registerKind,
  activeKindId: activeKindId,
  isBlockedTarget: isBlockedTarget,
  wheelFactor: wheelFactor,
  leaveBlank: leaveBlank,
  openBlankProps: openBlankProps,
  bind: bind,
};

export const CanvasInteraction = Canvas;

if (stageEl) bind(stageEl);

export { CHROME_SEL };
export default Canvas;
