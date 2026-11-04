/* A small HTML tree for Node tests: just enough DOM for the Sketch source code, which only reads and rewrites
 * elements, text nodes, <br>, and attributes. It is not a browser parser.
 * Grammar: <tag attr="v">, </tag>, void tags (br, img, hr), text, and raw text inside script and style.
 * Entities: &amp; &lt; &gt; &nbsp; in text. Real parsing is checked in a browser, not here. */

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const VOID = { br: 1, img: 1, hr: 1 };
const RAW = { script: 1, style: 1 };

export function createFakeDocument() {
  const doc = { createElement, createTextNode, createDocumentFragment, parse, serialize };

  function adopt(node) {
    node.ownerDocument = doc;
    node.childNodes = [];
    node.parentNode = null;
    node.appendChild = (child) => {
      if (child.nodeType === 11) {
        child.childNodes.slice().forEach((kid) => node.appendChild(kid));
        return child;
      }
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = node;
      node.childNodes.push(child);
      return child;
    };
    node.removeChild = (child) => {
      node.childNodes.splice(node.childNodes.indexOf(child), 1);
      child.parentNode = null;
      return child;
    };
    Object.defineProperty(node, 'firstChild', { get: () => node.childNodes[0] || null });
    return node;
  }

  function createTextNode(value) {
    return adopt({ nodeType: 3, nodeName: '#text', nodeValue: String(value) });
  }

  function createDocumentFragment() {
    return adopt({ nodeType: 11, nodeName: '#document-fragment' });
  }

  function createElement(name) {
    const attrs = new Map();
    const el = adopt({
      nodeType: 1,
      nodeName: String(name).toUpperCase(),
      namespaceURI: HTML_NS,
      setAttribute: (key, value) => attrs.set(key, String(value)),
      getAttribute: (key) => (attrs.has(key) ? attrs.get(key) : null),
      removeAttribute: (key) => attrs.delete(key),
      hasAttribute: (key) => attrs.has(key),
      attrs,
    });
    el.replaceChildren = (...nodes) => {
      while (el.firstChild) el.removeChild(el.firstChild);
      nodes.forEach((node) => el.appendChild(node));
    };
    if (name === 'template') {
      el.content = createDocumentFragment();
      Object.defineProperty(el, 'innerHTML', {
        get: () => serialize(el.content),
        set: (html) => { parse(html, el.content); },
      });
    }
    return el;
  }

  function decode(text) {
    return text.replace(/&nbsp;/g, '\u00a0').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  function encode(text) {
    return text.replace(/&/g, '&amp;').replace(/\u00a0/g, '&nbsp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function parse(html, into) {
    const root = into || createDocumentFragment();
    const open = [root];
    const token = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*>|([^<]+)/g;
    let hit;
    while ((hit = token.exec(html))) {
      const parent = open[open.length - 1];
      if (hit[4] !== undefined) {
        parent.appendChild(createTextNode(decode(hit[4])));
      } else if (hit[1]) {
        open.pop();
      } else {
        const name = hit[2].toLowerCase();
        const el = createElement(name);
        String(hit[3]).replace(/([^\s=>]+)(?:="([^"]*)")?/g, (_all, key, value) => { el.setAttribute(key, value || ''); return ''; });
        parent.appendChild(el);
        if (RAW[name]) {
          const end = html.indexOf('</' + name + '>', token.lastIndex);
          el.appendChild(createTextNode(html.slice(token.lastIndex, end)));
          token.lastIndex = end + name.length + 3;
        } else if (!VOID[name]) {
          open.push(el);
        }
      }
    }
    return root;
  }

  function serialize(node) {
    return node.childNodes.map((kid) => {
      if (kid.nodeType === 3) return RAW[String(node.nodeName).toLowerCase()] ? kid.nodeValue : encode(kid.nodeValue);
      const name = kid.nodeName.toLowerCase();
      const attrs = Array.from(kid.attrs).map(([key, value]) => ' ' + key + '="' + value + '"').join('');
      return VOID[name] ? '<' + name + attrs + '>' : '<' + name + attrs + '>' + serialize(kid) + '</' + name + '>';
    }).join('');
  }

  return doc;
}
