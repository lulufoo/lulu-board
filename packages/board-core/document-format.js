/* Shared document envelope: graph id, leading meta strip (P4 loose), titles. */
export const GRAPH_ID_RE = /^b_[0-9a-f]{8}$/;
const META_LINE = /^meta\s+(\S+|{.*})\s*$/;
const META_LOOSE = /^(?:%%\s*)?meta\s+/;

export function encodeMetaPayload(meta) {
  const json = JSON.stringify({ id: String(meta.id), version: Number(meta.version) });
  if (typeof Buffer !== 'undefined') return Buffer.from(json, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeMetaPayload(token) {
  const text = String(token == null ? '' : token).trim();
  if (!text) throw new Error('document meta required');
  let json;
  if (text.charAt(0) === '{') {
    json = text;
  } else {
    const compact = text.replace(/\s+/g, '');
    try {
      json = typeof Buffer !== 'undefined'
        ? Buffer.from(compact, 'base64').toString('utf8')
        : decodeURIComponent(escape(atob(compact)));
    } catch (_e) {
      throw new Error('document meta required');
    }
  }
  let data;
  try { data = JSON.parse(json); } catch (_e) { throw new Error('document meta required'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('document meta required');
  const id = data.id != null ? String(data.id).trim() : '';
  const version = data.version;
  if (!GRAPH_ID_RE.test(id) || !Number.isInteger(version) || version < 1) throw new Error('document meta required');
  return { id, version };
}

export function splitDocument(text) {
  const raw = String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length && !String(lines[i] || '').trim()) i += 1;
  const found = [];
  while (i < lines.length) {
    const hit = String(lines[i]).trim().match(META_LINE);
    if (!hit) break;
    try { found.push(decodeMetaPayload(hit[1])); } catch (_e) { /* leftover junk */ }
    i += 1;
    while (i < lines.length && !String(lines[i] || '').trim()) i += 1;
  }
  if (!found.length) throw new Error('document meta required');
  let meta = found[0];
  for (let n = 1; n < found.length; n += 1) {
    if (found[n].version > meta.version) meta = found[n];
  }
  return { meta, body: lines.slice(i).join('\n') };
}

export function joinDocument(meta, body) {
  const id = String(meta.id);
  const rest = String(body == null ? '' : body);
  const line = 'meta ' + encodeMetaPayload({ id, version: Number(meta.version) });
  if (rest.charAt(0) === '\n') return line + rest;
  if (rest) return line + '\n' + rest;
  return line + '\n';
}

export function stripDocumentMeta(text) {
  const raw = String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length && !String(lines[i] || '').trim()) i += 1;
  while (i < lines.length) {
    if (!META_LOOSE.test(String(lines[i]).trim())) break;
    i += 1;
    while (i < lines.length && !String(lines[i] || '').trim()) i += 1;
  }
  return lines.slice(i).join('\n');
}

export function sourceBody(text) {
  return stripDocumentMeta(text);
}

function randomFourBytes() {
  const web = typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues
    ? globalThis.crypto
    : null;
  if (web) {
    const raw = new Uint8Array(4);
    web.getRandomValues(raw);
    return raw;
  }
  try {
    const req = Function('return typeof require === "function" ? require : null')();
    if (req) return req('crypto').randomBytes(4);
  } catch (_e) {}
  throw new Error('no CSPRNG');
}

export function newGraphId(bytes) {
  const raw = bytes || randomFourBytes();
  let hex = '';
  for (let i = 0; i < raw.length; i += 1) hex += ('0' + raw[i].toString(16)).slice(-2);
  return 'b_' + hex;
}

export function isGraphId(id) {
  return GRAPH_ID_RE.test(String(id || '').trim());
}

export function assertGraphId(graphId) {
  const id = String(graphId || '').trim();
  if (!GRAPH_ID_RE.test(id)) throw new Error('invalid board id');
  return id;
}

function titledName(title) {
  let name = String(title == null ? 'Untitled' : title).replace(/"/g, '');
  if (!name) name = 'Untitled';
  return name;
}

export function blankHashBoardSource(title) {
  return 'boxes "' + titledName(title) + '"\n';
}

function matchMermaidTitleLine(line) {
  return /^%%\s*title\s*:?\s*(.*)$/i.exec(String(line || '').trim());
}

function mermaidTitleFromMatch(hit) {
  if (!hit) return '';
  return String(hit[1] || '').replace(/^["']|["']$/g, '').trim();
}

function firstDiagramLineIndex(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const t = String(lines[i] || '').trim();
    if (!t) continue;
    if (/^%%/.test(t)) continue;
    if (/^(?:%%\s*)?style\s+/i.test(t)) continue;
    if (/^(?:%%\s*)?meta\s+/i.test(t)) continue;
    return i;
  }
  return 0;
}

function sketchTitleFromLine(line) {
  const hit = /^\s*sketch\s+"([^"]*)"/.exec(String(line || ''));
  return hit ? hit[1] : '';
}

export function diagramTitleFromBody(body) {
  const text = String(body || '');
  const board = /^\s*boxes\s+"([^"]*)"/.exec(text);
  if (board) return board[1];
  const lines = text.split(/\r?\n/);
  let i;
  for (i = 0; i < lines.length; i += 1) {
    const sketch = sketchTitleFromLine(lines[i]);
    if (sketch) return sketch;
  }
  for (i = 0; i < lines.length; i += 1) {
    const title = mermaidTitleFromMatch(matchMermaidTitleLine(lines[i]));
    if (title) return title;
  }
  return '';
}

export function updateMermaidTitle(source, title) {
  const name = String(title == null ? '' : title).replace(/[\r\n]/g, ' ').trim();
  const lines = String(source == null ? '' : source).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let found = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (matchMermaidTitleLine(lines[i])) {
      found = i;
      break;
    }
  }
  if (!name) {
    if (found >= 0) lines.splice(found, 1);
    return lines.join('\n');
  }
  const next = '%% title ' + name;
  if (found >= 0) {
    lines[found] = next;
    return lines.join('\n');
  }
  lines.splice(firstDiagramLineIndex(lines), 0, next);
  return lines.join('\n');
}

export const stripPersistedMeta = stripDocumentMeta;
export const boardTitleFromBody = diagramTitleFromBody;
