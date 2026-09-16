import { snapdom } from './snapdom.mjs';

const PNG_EXPORT_SCALE = 2;
const PNG_EXPORT_PADDING = 24;
const PNG_EXPORT_CAPTURE_BLEED = 64;
const PNG_EXPORT_MAX_EDGE = 16384;
const PNG_EXPORT_MAX_PIXELS = 64_000_000;

function getExportContentTarget() {
  return previewEl && previewEl.querySelector('.board-render');
}

function getExportContentSize(target) {
  const rect = target.getBoundingClientRect();
  const activeScale = Number(scale) > 0 ? Number(scale) : 1;
  const width = target.clientWidth || target.offsetWidth || rect.width / activeScale;
  const height = target.clientHeight || target.offsetHeight || rect.height / activeScale;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Diagram has no exportable size');
  }
  return { width: Math.ceil(width), height: Math.ceil(height) };
}

function stripExportInteractions(root) {
  const interactive = [
    root,
    ...root.querySelectorAll(
      '.board-selection, .board-reorder-dragging, .board-reorder-caret'
    ),
  ];
  interactive.forEach((el) => {
    el.classList.remove(
      'board-selection',
      'board-reorder-dragging'
    );
  });
  root.querySelectorAll(
    '.board-edge-hit, .board-reorder-caret'
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
  clone.style.width = `${size.width}px`;
  clone.style.height = `${size.height}px`;
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

function paintExportGrid(ctx, canvas, surfaceSize) {
  const kami = String(document.documentElement.dataset.diagramTheme || '').toLowerCase() === 'kami';
  const background = kami ? '#f5f4ed' : '#f8fafc';
  const line = kami ? 'rgba(80,78,73,.08)' : 'rgba(100,116,139,.12)';
  const spacing = kami ? 24 : 20;
  const pixelRatio = canvas.width / surfaceSize.width;
  const step = spacing * pixelRatio;
  const lineWidth = Math.max(1, Math.round(pixelRatio));

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = line;
  for (let x = 0; x < canvas.width; x += step) ctx.fillRect(Math.round(x), 0, lineWidth, canvas.height);
  for (let y = 0; y < canvas.height; y += step) ctx.fillRect(0, Math.round(y), canvas.width, lineWidth);
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}

async function writePngExport(blob, stem) {
  const response = await fetch('./export.png', {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/png',
      'X-Export-Stem': stem,
    },
    body: blob,
  });
  if (!response.ok) throw new Error(`PNG export failed (${response.status})`);
  const result = await response.json();
  if (!result || !result.ok || !result.path) throw new Error('PNG export did not return a path');
  return result.path;
}

async function exportPng() {
  const target = getExportContentTarget();
  if (!target) {
    setStatus('Nothing to export', true);
    return;
  }
  const button = $('#btnCanvasDlPng');
  if (button) button.disabled = true;
  let host;
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const size = getExportContentSize(target);
    const surfaceSize = {
      width: size.width + PNG_EXPORT_CAPTURE_BLEED * 2,
      height: size.height + PNG_EXPORT_CAPTURE_BLEED * 2,
    };
    if (
      surfaceSize.width * PNG_EXPORT_SCALE > PNG_EXPORT_MAX_EDGE
      || surfaceSize.height * PNG_EXPORT_SCALE > PNG_EXPORT_MAX_EDGE
      || surfaceSize.width * surfaceSize.height * PNG_EXPORT_SCALE ** 2 > PNG_EXPORT_MAX_PIXELS
    ) {
      throw new Error('Diagram is too large to export');
    }

    ({ host } = mountExportClone(target, size));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const captured = await snapdom.toCanvas(host, {
      backgroundColor: null,
      dpr: 1,
      outerTransforms: false,
      scale: PNG_EXPORT_SCALE,
    });
    const cropped = cropExportCanvas(captured, surfaceSize);
    const output = document.createElement('canvas');
    output.width = cropped.canvas.width;
    output.height = cropped.canvas.height;
    const context = output.getContext('2d');
    paintExportGrid(context, output, cropped.surfaceSize);
    context.drawImage(cropped.canvas, 0, 0);

    const stem = exportStem(activeSourcePath().split('/').pop().replace(/\.[^.]+$/, ''), 'diagram');
    const path = await writePngExport(await canvasToPngBlob(output), stem);
    setStatus('PNG exported');
    if (!await copyText(path, 'PNG path')) showCopyTip('PNG exported');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'PNG export failed', true);
    showCopyTip('PNG export failed');
  } finally {
    if (host) host.remove();
    if (button) button.disabled = false;
  }
}
