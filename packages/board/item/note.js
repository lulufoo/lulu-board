/* Concrete item type=note. Dog-ear chrome; markdown is shared on Item. */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View || !View.Item) throw new Error('BoardItem must load before item-note.js');

  class ItemNote extends View.Item {
    typeName() { return 'note'; }
    framed() { return true; }
    decorate(el, ctx) {
      super.decorate(el, ctx);
      el.classList.add('board-item-note');
    }
    mount(ctx) {
      const el = super.mount(ctx);
      const sheet = ctx.doc.createElement('span');
      sheet.className = 'board-item-note-sheet';
      sheet.setAttribute('aria-hidden', 'true');
      const fold = ctx.doc.createElement('span');
      fold.className = 'board-item-note-fold';
      fold.setAttribute('aria-hidden', 'true');
      el.insertBefore(sheet, el.firstChild);
      el.appendChild(fold);
      return el;
    }
  }

  View.Types.registerItem('note', ItemNote);
})(typeof globalThis !== 'undefined' ? globalThis : this);
