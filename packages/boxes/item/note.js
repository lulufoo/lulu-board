/* Concrete item type=note. Dog-ear chrome; markdown is shared on Item. */
/* Concrete item type=note. Dog-ear chrome; markdown is shared on Item. */
import View from '../view/view.js';

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
export { ItemNote };
