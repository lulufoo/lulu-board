/* PNG / file export. SnapDOM stays a static import for the vendor copy next to the bundle. */
import BoxesRender from '../../../boxes/index.js';
import { snapdom } from './snapdom.mjs';
import Sketch from '../kinds/sketch.js';
import DrawerStyleLine from '../core/style-line.js';
import { kindTemplateFileName } from '../core/kind-template.js';
import { paintGround } from '../core/workspace-ground.js';
import { getSessionAppearance } from '../core/session-appearance.js';
import { register, call } from '../core/hooks.js';
import { exportStem, showCopyTip } from './render-io.js';
import {
  $,
  previewEl,
  diagramSourceEl,
  liveDiagramPath,
  liveRecordId,
  setStatus,
} from '../state/shell-state.js';

const PNG_EXPORT_SCALE = 2;
const PNG_EXPORT_PADDING = 24;
const PNG_EXPORT_CAPTURE_BLEED = 64;
const PNG_EXPORT_MAX_EDGE = 16384;
const PNG_EXPORT_MAX_PIXELS = 64_000_000;

function getExportContentTarget() {
  return previewEl && previewEl.querySelector('.board-render');
}

/* Capture frame = world bounds of nodes + edges (negative coordinates included).
 * `shift` moves the clone so world (minX, minY) lands on the frame's corner. */
function getExportContentSize(target) {
  const bounds = typeof BoxesRender !== 'undefined' && typeof BoxesRender.worldBounds === 'function'
    ? BoxesRender.worldBounds(target)
    : null;
  if (!bounds || !(bounds.width > 0) || !(bounds.height > 0)) {
    throw new Error('Diagram has no exportable size');
  }
  const canvas = target.querySelector('.board-canvas');
  const canvasOffset = {
    x: canvas ? canvas.offsetLeft || 0 : 0,
    y: canvas ? canvas.offsetTop || 0 : 0,
  };
  return {
    width: Math.ceil(bounds.width),
    height: Math.ceil(bounds.height),
    shift: {
      x: -(bounds.minX + canvasOffset.x),
      y: -(bounds.minY + canvasOffset.y),
    },
  };
}

function stripExportInteractions(root) {
  const interactive = [
    root,
    ...root.querySelectorAll(
      '.board-selection, .canvas-selected, .canvas-hover, .board-reorder-dragging, .board-reorder-caret'
    ),
  ];
  interactive.forEach((el) => {
    el.classList.remove(
      'board-selection',
      'canvas-selected',
      'canvas-hover',
      'board-reorder-dragging'
    );
  });
  root.querySelectorAll(
    '.board-edge-hit, .board-reorder-caret, .mermaid-edge-hit, .flowchart-selection-halo, .mindmap-selection-halo, .canvas-hover-halo, .mindmap-add, .mindmap-add-zone'
  ).forEach((el) => el.remove());
}

function mountExportClone(target, size) {
  const surfaceSize = {
    width: size.width + PNG_EXPORT_CAPTURE_BLEED * 2,
    height: size.height + PNG_EXPORT_CAPTURE_BLEED * 2,
  };
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    `width:${surfaceSize.width}px`,
    `height:${surfaceSize.height}px`,
    'overflow:visible',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');

  const stage = document.createElement('div');
  stage.id = 'preview';
  stage.style.cssText = [
    'position:absolute',
    `left:${PNG_EXPORT_CAPTURE_BLEED}px`,
    `top:${PNG_EXPORT_CAPTURE_BLEED}px`,
    `width:${size.width}px`,
    `height:${size.height}px`,
    'min-width:0',
    'min-height:0',
    'padding:0',
    'transform:none',
  ].join(';');
  const clone = target.cloneNode(true);
  clone.style.position = 'absolute';
  clone.style.left = `${size.shift ? size.shift.x : 0}px`;
  clone.style.top = `${size.shift ? size.shift.y : 0}px`;
  clone.style.width = 'max-content';
  clone.style.height = 'auto';
  clone.style.transform = 'none';
  stripExportInteractions(clone);
  stage.appendChild(clone);
  host.appendChild(stage);
  document.body.appendChild(host);
  return { host, surfaceSize };
}

function findExportInkBounds(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error('Diagram has no visible content');
  return { left, top, right, bottom };
}

function cropExportCanvas(canvas, surfaceSize) {
  const inkBounds = findExportInkBounds(canvas);
  const pixelRatio = canvas.width / surfaceSize.width;
  const padding = Math.ceil(PNG_EXPORT_PADDING * pixelRatio);
  const left = Math.max(0, inkBounds.left - padding);
  const top = Math.max(0, inkBounds.top - padding);
  const right = Math.min(canvas.width, inkBounds.right + padding + 1);
  const bottom = Math.min(canvas.height, inkBounds.bottom + padding + 1);
  const cropped = document.createElement('canvas');
  cropped.width = right - left;
  cropped.height = bottom - top;
  cropped.getContext('2d').drawImage(
    canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height
  );
  return {
    canvas: cropped,
    surfaceSize: {
      width: cropped.width / pixelRatio,
      height: cropped.height / pixelRatio,
    },
  };
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}

function exportDiagramStem() {
  const parsed = call("getDiagramTitle", call("cloudOpenDiagramId")) || "";
  const title = parsed === "Untitled" ? "" : parsed;
  const id = liveRecordId();
  const path = liveDiagramPath || "";
  const fromPath = path ? String(path).split("/").pop().replace(/\.[^.]+$/, "") : "";
  return exportStem(title || fromPath || id, "board");
}

async function saveExportBlob(blob, filename, mime, description) {
  const name = String(filename || "board");
  const extMatch = name.match(/(\.[A-Za-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : "";
  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const accept = {};
      accept[mime || "application/octet-stream"] = ext ? [ext] : [];
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: description || (ext === ".png" ? "PNG image" : "Board file"), accept }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "picker";
    } catch (error) {
      if (error && error.name === "AbortError") return "abort";
    }
  }
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  return "download";
}

/* The suffix follows the source kind, the same way the new-diagram templates are named:
 * .bmd for Boxes, .skt for Sketch, .mmd for Mermaid. A kind the template table does not
 * know keeps the old .bmd. */
const EXPORT_FILE_FALLBACK_SUFFIX = ".bmd";
const EXPORT_FILE_LABELS = { ".bmd": "Board file", ".skt": "Sketch file", ".mmd": "Mermaid file" };

function exportFileSuffix(kind) {
  if (kind === "mermaid-unsupported") return ".mmd";
  const file = kindTemplateFileName(kind);
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(dot) : EXPORT_FILE_FALLBACK_SUFFIX;
}

export async function exportDiagramFile() {
  const text = diagramSourceEl ? diagramSourceEl.value : "";
  if (!String(text).trim()) {
    setStatus("Nothing to export", true);
    showCopyTip("Nothing to export");
    return;
  }
  const suffix = exportFileSuffix(DrawerStyleLine.bodyKind ? DrawerStyleLine.bodyKind(text) : "");
  const result = await saveExportBlob(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
    exportDiagramStem() + suffix,
    "text/plain",
    EXPORT_FILE_LABELS[suffix]
  );
  if (result === "abort") return;
  const message = result === "picker" ? "File saved" : "File exported";
  setStatus(message);
  showCopyTip(message);
}

async function writePngExport(blob, stem) {
  return saveExportBlob(blob, String(stem || "board") + ".png", "image/png");
}

function assertExportSurface(surfaceSize) {
  if (
    surfaceSize.width * PNG_EXPORT_SCALE > PNG_EXPORT_MAX_EDGE
    || surfaceSize.height * PNG_EXPORT_SCALE > PNG_EXPORT_MAX_EDGE
    || surfaceSize.width * surfaceSize.height * PNG_EXPORT_SCALE ** 2 > PNG_EXPORT_MAX_PIXELS
  ) {
    throw new Error('Diagram is too large to export');
  }
}

/* A sketch lives in its own sandboxed iframe on another origin, so there is no board canvas to clone and
 * its document cannot be read. The runner captures itself and sends back a transparent bitmap, which is
 * then set inside a transparent bleed so crop and grid treat it like a board capture. */
function getExportSketchFrame() {
  return previewEl && previewEl.querySelector('iframe.sketch-frame');
}

async function captureSketchCanvas(frame) {
  const bounds = Sketch.sketchWorldBounds(frame);
  if (!bounds) throw new Error('Diagram has no exportable size');
  const size = { width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) };
  assertExportSurface({
    width: size.width + PNG_EXPORT_CAPTURE_BLEED * 2,
    height: size.height + PNG_EXPORT_CAPTURE_BLEED * 2,
  });
  const shot = await Sketch.captureSketch(frame, PNG_EXPORT_SCALE);
  // The runner's scripts are untrusted: a bitmap far larger than the sketch is refused before it is drawn.
  const maxEdge = Math.min(PNG_EXPORT_MAX_EDGE, Math.max(size.width, size.height) * PNG_EXPORT_SCALE * 2);
  if (!(shot.width > 0 && shot.height > 0) || Math.max(shot.width, shot.height) > maxEdge) {
    throw new Error('Sketch capture came back at an unexpected size');
  }
  const pixelRatio = shot.width / size.width;
  const bleed = Math.round(PNG_EXPORT_CAPTURE_BLEED * pixelRatio);
  const captured = document.createElement('canvas');
  captured.width = shot.width + bleed * 2;
  captured.height = shot.height + bleed * 2;
  captured.getContext('2d').drawImage(shot, bleed, bleed);
  if (typeof shot.close === 'function') shot.close();
  return {
    captured,
    surfaceSize: { width: captured.width / pixelRatio, height: captured.height / pixelRatio },
  };
}

function documentAppearance() {
  return getSessionAppearance();
}

export async function exportPng() {
  const frame = getExportSketchFrame();
  const target = frame ? null : getExportContentTarget();
  if (!frame && !target) {
    setStatus('Nothing to export', true);
    showCopyTip('Nothing to export');
    return;
  }
  const button = $('#btnCanvasDlPng');
  if (button) button.disabled = true;
  let host;
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    let captured;
    let surfaceSize;
    if (frame) {
      ({ captured, surfaceSize } = await captureSketchCanvas(frame));
    } else {
      const size = getExportContentSize(target);
      surfaceSize = {
        width: size.width + PNG_EXPORT_CAPTURE_BLEED * 2,
        height: size.height + PNG_EXPORT_CAPTURE_BLEED * 2,
      };
      assertExportSurface(surfaceSize);

      ({ host } = mountExportClone(target, size));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      captured = await snapdom.toCanvas(host, {
        backgroundColor: null,
        dpr: 1,
        outerTransforms: false,
        scale: PNG_EXPORT_SCALE,
      });
    }
    const cropped = cropExportCanvas(captured, surfaceSize);
    const output = document.createElement('canvas');
    output.width = cropped.canvas.width;
    output.height = cropped.canvas.height;
    const context = output.getContext('2d');
    paintGround(context, output, cropped.surfaceSize, documentAppearance());
    context.drawImage(cropped.canvas, 0, 0);

    const result = await writePngExport(await canvasToPngBlob(output), exportDiagramStem());
    if (result === "abort") return;
    const message = result === "picker" ? "PNG saved" : "PNG exported";
    setStatus(message);
    showCopyTip(message);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'PNG export failed', true);
    showCopyTip('PNG export failed');
  } finally {
    if (host) host.remove();
    if (button) button.disabled = false;
  }
}

register("exportPng", exportPng);
register("exportDiagramFile", exportDiagramFile);
register("exportDiagramStem", exportDiagramStem);
