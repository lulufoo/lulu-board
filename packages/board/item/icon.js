/* Concrete item type=icon. Catalog glyph + optional text. */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View || !View.Item) throw new Error('BoardItem must load before item/icon.js');
  const Icons = root.BoardIcons;

  class ItemIcon extends View.Item {
    typeName() { return 'icon'; }
    framed() { return false; }
    intrinsicMinWidth() {
      const text = String(this.data.text || '');
      if (!text) return 20;
      return 28 + 8 + Math.max(24, Math.min(text.length, 24) * 6.4);
    }
    decorate(el, ctx) {
      super.decorate(el, ctx);
      el.classList.add('board-item-icon');
      if (!String(this.data.text || '').trim()) el.classList.add('is-icon-only');
    }
    mount(ctx) {
      const el = super.mount(ctx);
      const copy = el.querySelector('.board-item-copy');
      const glyph = ctx.doc.createElement('span');
      glyph.className = 'board-item-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      const svg = Icons && Icons.glyph ? Icons.glyph(this.data.icon) : null;
      if (svg) glyph.innerHTML = svg;
      el.insertBefore(glyph, copy);
      if (!String(this.data.text || '').trim() && copy) copy.remove();
      return el;
    }
  }

  View.Types.registerItem('icon', ItemIcon);
})(typeof globalThis !== 'undefined' ? globalThis : this);
