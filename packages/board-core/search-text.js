/* Search text for a board body. Sketch decodes content; other kinds keep source words. */

const STYLE_LINE = /^(?:%%\s*)?style\s+\S+\s*$/i;
const META_LINE = /^(?:%%\s*)?meta\s+/i;
const SKETCH_TITLE = /^\s*sketch\s+"([^"]*)"/;
const CONTENT_LINE = /^content\s+(\S+)\s*$/i;

function linesOf(body) {
  return String(body == null ? '' : body).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function firstKindLine(body) {
  const lines = linesOf(body);
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '').trim();
    if (!line) continue;
    if (line.charAt(0) === '#' || line.indexOf('//') === 0) continue;
    if (line.indexOf('%%') === 0 || /^meta\s+/i.test(line)) continue;
    if (/^---/.test(line)) continue;
    if (STYLE_LINE.test(line)) continue;
    return line;
  }
  return '';
}

function collapse(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function plainSearchText(body) {
  const kept = [];
  const lines = linesOf(body);
  for (let i = 0; i < lines.length; i += 1) {
    const trim = String(lines[i] || '').trim();
    if (!trim || STYLE_LINE.test(trim) || META_LINE.test(trim)) continue;
    kept.push(trim);
  }
  return collapse(kept.join(' '));
}

function decodeBase64Utf8(b64) {
  try {
    const raw = String(b64 || '').replace(/\s+/g, '');
    if (!raw) return '';
    if (typeof Buffer !== 'undefined') return Buffer.from(raw, 'base64').toString('utf8');
    return decodeURIComponent(escape(atob(raw)));
  } catch (_e) {
    return '';
  }
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
      return String.fromCodePoint(code);
    });
}

function visibleHtml(html) {
  const stripped = String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return collapse(decodeEntities(stripped));
}

function sketchSearchText(body) {
  const lines = linesOf(body);
  let title = '';
  let token = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '');
    if (!title) {
      const hit = SKETCH_TITLE.exec(line);
      if (hit) title = hit[1];
    }
    if (!token) {
      const content = CONTENT_LINE.exec(line.trim());
      if (content) token = content[1];
    }
  }
  const parts = [];
  if (title) parts.push(title);
  const visible = visibleHtml(decodeBase64Utf8(token));
  if (visible) parts.push(visible);
  return collapse(parts.join(' '));
}

export function searchTextFromBody(body) {
  if (/^sketch\b/i.test(firstKindLine(body))) return sketchSearchText(body);
  return plainSearchText(body);
}
