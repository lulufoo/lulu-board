/* Concrete item type=chip. Optional shape=diamond cuts the frame. */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View || !View.Item) throw new Error('BoardItem must load before item-chip.js');

  class ItemChip extends View.Item {
    typeName() { return 'chip'; }
    shapeName() {
      return String(this.data.shape || 'rect').toLowerCase() === 'diamond' ? 'diamond' : 'rect';
    }
    framed() { return true; }
    decorate(el, ctx) {
      if (this.shapeName() !== 'diamond') return;
      if (typeof View.decorateChipDiamond === 'function') View.decorateChipDiamond(el, this.data, ctx);
    }
    measureLive(el, base) {
      if (this.shapeName() === 'diamond' && typeof View.measureChipDiamond === 'function') {
        return View.measureChipDiamond(el, base);
      }
      return super.measureLive(el, base);
    }
    intrinsicMinWidth() {
      if (this.shapeName() === 'diamond') return 96;
      return super.intrinsicMinWidth();
    }
  }

  View.Types.registerItem('chip', ItemChip);
})(typeof globalThis !== 'undefined' ? globalThis : this);
