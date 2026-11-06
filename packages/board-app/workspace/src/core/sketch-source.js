/* Sketch source editing: which text a person can pick, and how an edit is written back.
 * Every function takes a parsed fragment (the content of a <template>), never a string of HTML, so a hand-built
 * tree drives it in Node too.
 *
 * A target id is an element-index path over the fragment as the source parses it ("1.0.3": the second top-level
 * element, its first element child, that one's fourth). It is computed, never stored in the source. Editing the
 * text of a piece of text keeps the path of everything, so the id stays good until the structure itself changes. */
import DrawerStyleLine from './style-line.js';
import {
  SANDBOX_TARGET_ATTR,
  SANDBOX_SELECTED_ATTR,
  isSketchTarget,
  splitSketchText,
} from '../../../../sandbox-app/src/protocol.js';

var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var HTML_NS = 'http://www.w3.org/1999/xhtml';
// Code and form values are not text a person reads. Links are unwrapped, and nested documents removed, before the
// frame mounts; <pre> keeps its whitespace, which a text box would flatten.
var NOT_PICKABLE = {
  SCRIPT: 1, STYLE: 1, TEMPLATE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1, PRE: 1,
  A: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1,
};
// HTML collapses these, and only these. A no-break space is text.
var HTML_SPACE_RUN = /[ \t\n\r\f]+/g;
var HAS_NON_SPACE = /[^ \t\n\r\f]/;

function nameOf(node) {
  return String(node.nodeName || '').toUpperCase();
}

function elementChildren(node) {
  var out = [];
  var kids = node.childNodes || [];
  for (var i = 0; i < kids.length; i += 1) {
    if (kids[i].nodeType === ELEMENT_NODE) out.push(kids[i]);
  }
  return out;
}

/* An element whose children are only text and <br>, in the HTML namespace and not one of the excluded tags. */
function holdsOnlyText(el) {
  if (el.namespaceURI && el.namespaceURI !== HTML_NS) return false;
  if (NOT_PICKABLE[nameOf(el)]) return false;
  var kids = el.childNodes || [];
  for (var i = 0; i < kids.length; i += 1) {
    var kid = kids[i];
    if (kid.nodeType !== TEXT_NODE && !(kid.nodeType === ELEMENT_NODE && nameOf(kid) === 'BR')) return false;
  }
  return true;
}

/* Pickable: holds only text, and at least one piece of it is more than spaces. */
function isPickable(el) {
  if (!holdsOnlyText(el)) return false;
  var kids = el.childNodes || [];
  for (var i = 0; i < kids.length; i += 1) {
    if (kids[i].nodeType === TEXT_NODE && HAS_NON_SPACE.test(kids[i].nodeValue || '')) return true;
  }
  return false;
}

function walkElements(parent, prefix, visit) {
  var list = elementChildren(parent);
  for (var i = 0; i < list.length; i += 1) {
    var id = prefix + i;
    visit(list[i], id);
    walkElements(list[i], id + '.', visit);
  }
}

function elementAt(root, id) {
  if (!isSketchTarget(id)) return null;
  var node = root;
  var parts = id.split('.');
  for (var i = 0; i < parts.length && node; i += 1) node = elementChildren(node)[Number(parts[i])] || null;
  return node;
}

/* The ids of every pickable piece of text, in document order. Reads only. */
export function listSketchLeaves(root) {
  var ids = [];
  walkElements(root, '', function (el, id) {
    if (isPickable(el)) ids.push(id);
  });
  return ids;
}

/* Stamp the target id on each pickable element of a copy that is about to be sent to the frame. An attribute that
 * the source already carries under either name is removed first: it must not pass for Board's own. */
export function stampSketchLeaves(root) {
  var ids = [];
  walkElements(root, '', function (el, id) {
    el.removeAttribute(SANDBOX_TARGET_ATTR);
    el.removeAttribute(SANDBOX_SELECTED_ATTR);
    if (!isPickable(el)) return;
    el.setAttribute(SANDBOX_TARGET_ATTR, id);
    ids.push(id);
  });
  return ids;
}

/* What the text box shows for one piece of text, or null when the id is not a pickable element here.
 * HTML collapses white space, so runs become one space and a space beside a line break goes. A space at either
 * end of the whole text may sit between inline neighbors, so it is returned apart as lead and trail, and writing
 * back puts it where it was. */
export function readSketchLeaf(root, id) {
  var el = elementAt(root, id);
  if (!el || !isPickable(el)) return null;
  var lines = [''];
  var kids = el.childNodes;
  for (var i = 0; i < kids.length; i += 1) {
    if (kids[i].nodeType === TEXT_NODE) lines[lines.length - 1] += (kids[i].nodeValue || '').replace(HTML_SPACE_RUN, ' ');
    else lines.push('');
  }
  var joined = lines.join('\n');
  var lead = joined.charAt(0) === ' ' ? ' ' : '';
  var trail = joined.length > lead.length && joined.slice(-1) === ' ' ? ' ' : '';
  var text = lines.map(function (line) { return line.replace(/^ | $/g, ''); }).join('\n');
  return { tag: nameOf(el).toLowerCase(), text: text, lead: lead, trail: trail };
}

/* Replace what one element holds with this text: a text node per line, a <br> between lines.
 * The element only has to hold nothing but text now, so a piece of text emptied a moment ago can be filled again. */
export function writeSketchLeaf(root, id, text) {
  var el = elementAt(root, id);
  if (!el || !holdsOnlyText(el)) return false;
  var doc = el.ownerDocument;
  while (el.firstChild) el.removeChild(el.firstChild);
  splitSketchText(text).forEach(function (line, index) {
    if (index) el.appendChild(doc.createElement('br'));
    if (line) el.appendChild(doc.createTextNode(line));
  });
  return true;
}

/* After a write, the source is parsed again from its new text. If that parse put the other pieces of text at other
 * paths, the ids the frame holds are wrong, and the caller must mount again instead of editing in place. */
export function sameSketchLeaves(before, after, id) {
  function others(list) {
    return list.filter(function (item) { return item !== id; }).join('|');
  }
  return others(before) === others(after);
}

export function encodeBase64Utf8(text) {
  var bytes = new TextEncoder().encode(String(text));
  var binary = '';
  for (var i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/* The SKT source with its `content` line holding this HTML. Every other line is kept byte for byte.
 * Returns null when the source has no content line. */
export function swapSketchContent(source, html) {
  var token = DrawerStyleLine.sketchContentToken(source);
  if (!token) return null;
  var lines = String(source).split('\n');
  for (var i = 0; i < lines.length; i += 1) {
    if (DrawerStyleLine.sketchContentToken(lines[i]) !== token) continue;
    var encoded = encodeBase64Utf8(html);
    lines[i] = lines[i].replace(token, function () { return encoded; });
    return lines.join('\n');
  }
  return null;
}
