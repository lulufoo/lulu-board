/* Internal item base. Concrete types live in item-*.js. */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View || !View.Node) throw new Error('BoardView must load before board-item.js');

  function decodeItemNewlines(value) {
    return String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')
      .replace(/\\n/g, '\n');
  }

  function usesItemMarkdown(itemType) {
    return itemType === 'chip' || itemType === 'text' || itemType === 'note';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inlineFormat(chunk, codes) {
    let text = escapeHtml(chunk);
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return text.replace(/\u0000C(\d+)\u0000/g, (_, index) => (
      '<code>' + escapeHtml(codes[Number(index)] || '') + '</code>'
    ));
  }

  function classifyLine(line) {
    const heading = /^(#{1,3})[ \t]+(.*)$/.exec(line);
    if (heading) return { type: 'h', level: heading[1].length, text: heading[2] };
    const ul = /^-[ \t]+(.*)$/.exec(line);
    if (ul) return { type: 'ul', text: ul[1] };
    const ol = /^(\d+)\.[ \t]+(.*)$/.exec(line);
    if (ol) return { type: 'ol', start: Number(ol[1]), text: ol[2] };
    return { type: 't', text: line };
  }

  function renderNoteMarkdown(raw) {
    const codes = [];
    const source = String(raw == null ? '' : raw).replace(/`([^`]+)`/g, (_, body) => {
      codes.push(body);
      return '\u0000C' + (codes.length - 1) + '\u0000';
    });
    const lines = source.split('\n').map(classifyLine);
    let html = '';
    for (let index = 0; index < lines.length;) {
      const line = lines[index];
      if (line.type === 'h') {
        html += '<h' + line.level + '>' + inlineFormat(line.text, codes) + '</h' + line.level + '>';
        index += 1;
        continue;
      }
      if (line.type === 'ul' || line.type === 'ol') {
        const kind = line.type;
        const items = [];
        const start = kind === 'ol' ? line.start : 1;
        while (index < lines.length && lines[index].type === kind) {
          items.push(lines[index].text);
          index += 1;
        }
        const startAttr = kind === 'ol' && start !== 1 ? ' start="' + start + '"' : '';
        html += '<' + kind + startAttr + '>' + items.map((text) => (
          '<li>' + inlineFormat(text, codes) + '</li>'
        )).join('') + '</' + kind + '>';
        continue;
      }
      html += inlineFormat(line.text, codes);
      const next = lines[index + 1];
      if (next && next.type === 't') html += '<br>';
      index += 1;
    }
    return html;
  }

  class Item extends View.Node {
    roleName() { return 'item'; }
    typeName() { return 'chip'; }
    framed() { return true; }

    decorate(el) {}

    applyFrame(el, frame) {
      super.applyFrame(el, frame);
      if (!el || !frame || !el.classList.contains('board-root-item')) return;
      el.style.minHeight = `${frame.h}px`;
      el.style.height = 'auto';
      if (el.dataset.boardCap === 'off') {
        el.style.width = 'max-content';
        el.style.maxWidth = 'none';
      }
    }

    intrinsicMinWidth() {
      const text = String(this.data.text || '');
      return Math.max(48, 48 + Math.min(text.length, 24) * 6.4);
    }

    mount(ctx) {
      const item = this.data;
      const doc = ctx.doc;
      const itemType = this.typeName();
      const rootItem = !ctx.parentBox;
      const el = doc.createElement('div');
      el.className = `item board-item board-item-type-${itemType}${this.framed() ? ' board-card' : ''}${rootItem ? ' board-root-item' : ''}`;
      if (rootItem) {
        el.dataset.boardKey = 'item:' + item.id;
        el.dataset.boardId = item.id;
        el.dataset.boardBoxId = '';
        el.dataset.boardItemIndex = '-1';
        el.style.position = 'absolute';
        el.style.boxSizing = 'border-box';
        if (item.id) ctx.elements.set(item.id, el);
      } else {
        el.dataset.boardKey = 'item:' + ctx.parentBox.id + ':' + ctx.itemIndex;
        el.dataset.boardBoxId = ctx.parentBox.id;
        el.dataset.boardItemIndex = String(ctx.itemIndex);
        if (item.id) {
          el.dataset.boardId = item.id;
          ctx.elements.set(item.id, el);
        }
      }
      el.dataset.boardKind = 'item';
      el.dataset.boardType = itemType;
      if (item.cap === 'off' && itemType !== 'icon') el.dataset.boardCap = 'off';
      this.decorate(el, ctx);
      const itemCopy = doc.createElement('span');
      itemCopy.className = 'board-item-copy';
      const itemText = doc.createElement('span');
      const raw = decodeItemNewlines(item.text);
      if (usesItemMarkdown(itemType)) {
        itemText.className = 'board-item-text board-item-md';
        itemText.innerHTML = renderNoteMarkdown(raw);
      } else {
        itemText.className = 'board-item-text';
        itemText.textContent = raw;
      }
      itemCopy.appendChild(itemText);
      el.appendChild(itemCopy);
      return el;
    }
  }

  View.decodeItemNewlines = decodeItemNewlines;
  View.usesItemMarkdown = usesItemMarkdown;
  View.renderNoteMarkdown = renderNoteMarkdown;
  View.Item = Item;
})(typeof globalThis !== 'undefined' ? globalThis : this);
