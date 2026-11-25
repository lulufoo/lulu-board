/* Validate a candidate Source without applying it, rendering it, or running Sketch content. */
import BoxesRender from '../../../../boxes/index.js';
import MindmapEdit from '../../../../mermaid/mindmap/index.js';
import { stripDocumentMeta } from '../core/document-meta.js';
import DrawerStyleLine from '../core/style-line.js';
import { encodeBase64Utf8 } from '../core/sketch-source.js';

function invalid(message) { return { ok: false, code: 'INVALID_SOURCE', message: message }; }

function validateSketch(source) {
  const statements = source.split(/\r?\n/).map(line => line.trim()).filter(function (line) {
    return line && !/^(#|\/\/|%%)/.test(line) && !DrawerStyleLine.isRendererStyleLine(line);
  });
  if (statements.length !== 2 || !/^sketch\s+"/i.test(statements[0]) || !/^content\s+\S+$/i.test(statements[1])) {
    throw new Error('Sketch needs one quoted title and one content line.');
  }
  if (typeof JSON.parse(statements[0].replace(/^sketch\s+/i, '')) !== 'string') {
    throw new Error('Sketch needs a quoted title.');
  }
  const token = DrawerStyleLine.sketchContentToken(source);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(token) || token.length % 4 === 1 || (token.includes('=') && token.length % 4 !== 0)) {
    throw new Error('Sketch content must be valid Base64 UTF-8.');
  }
  // The shared decoder is intentionally forgiving. Round-trip through the shared encoder
  // rejects invalid padding bits, ignored bytes, and malformed UTF-8 in either runtime.
  const fragment = DrawerStyleLine.decodeSketchContent(source);
  if (!fragment.trim() || encodeBase64Utf8(fragment).replace(/=+$/, '') !== token.replace(/=+$/, '')) {
    throw new Error('Sketch content must be nonempty Base64 UTF-8.');
  }
}

/** Returns a normalized Source body or an INVALID_SOURCE refusal. No page state is touched. */
export async function validateDiagramSource(candidate, options = {}) {
  if (typeof candidate !== 'string' || !candidate.trim()) return invalid('Source must be a nonempty string.');
  const source = stripDocumentMeta(candidate);
  const kind = DrawerStyleLine.bodyKind(source);
  if (kind !== 'boxes' && kind !== 'sketch' && kind !== 'mindmap' && kind !== 'flowchart' && !DrawerStyleLine.isDesignKind(kind)) {
    return invalid('Source must use a diagram kind supported by Board.');
  }
  try {
    if (kind === 'boxes') {
      BoxesRender.parse(source);
    } else if (kind === 'sketch') {
      validateSketch(source);
    } else {
      const body = DrawerStyleLine.splitRendererStyle(source).body;
      if (kind === 'mindmap') {
        const parsed = MindmapEdit.parseMindmap(body);
        if (!parsed.root || parsed.errors.length) throw new Error(parsed.errors.join('; ') || 'Mindmap needs a root.');
      } else {
        const pele = options.pele || (typeof window !== 'undefined' ? window.pele : null);
        if (!pele || typeof pele.parse !== 'function') return invalid('The diagram parser is unavailable. Reload Board and try again.');
        const parsed = await pele.parse(body.trim());
        if (!parsed || parsed.type !== kind || (parsed.errors && parsed.errors.length)) {
          throw new Error('The diagram parser did not accept this Source.');
        }
      }
    }
    return { ok: true, kind: kind, source: source };
  } catch (error) {
    return invalid(error && error.message ? String(error.message) : 'Source could not be parsed.');
  }
}
