/* Concrete item type=note. Dog-ear chrome; markdown is shared on Item. */
/* Concrete item type=note. Dog-ear chrome; markdown is shared on Item. */
import View from '../view/view.js';
import { HOVER_CENTER, SELECT_CENTER, noteRingPath } from './note-ring.js';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function ringPath(doc, className) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', className);
    path.setAttribute('fill', 'none');
    return path;
  }

  // Hover and selected rings follow the dog-ear. Both stay in the DOM; CSS shows one.
  // Zero size until fitNoteRing runs: an unsized <svg> is 300 x 150 and would inflate
  // the host's scroll extent when the engine measures the note.
  function mountRing(doc) {
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'board-item-note-ring');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.appendChild(ringPath(doc, 'board-item-note-ring-hover'));
    svg.appendChild(ringPath(doc, 'board-item-note-ring-select'));
    return svg;
  }

  // Layout pixels, fractions kept: the ring must sit the same distance from every side.
  function paperSize(el) {
    const view = el.ownerDocument && el.ownerDocument.defaultView;
    const cs = view && view.getComputedStyle ? view.getComputedStyle(el) : null;
    const w = cs ? parseFloat(cs.width) : NaN;
    const h = cs ? parseFloat(cs.height) : NaN;
    return {
      w: w > 0 ? w : el.clientWidth || 0,
      h: h > 0 ? h : el.clientHeight || 0,
    };
  }

  function fitNoteRing(el) {
    const svg = el.querySelector(':scope > .board-item-note-ring');
    if (!svg) return;
    const size = paperSize(el);
    if (!(size.w > 0) || !(size.h > 0)) return;
    svg.setAttribute('width', String(size.w));
    svg.setAttribute('height', String(size.h));
    svg.setAttribute('viewBox', '0 0 ' + size.w + ' ' + size.h);
    const hover = svg.querySelector('.board-item-note-ring-hover');
    const select = svg.querySelector('.board-item-note-ring-select');
    if (hover) hover.setAttribute('d', noteRingPath(size.w, size.h, HOVER_CENTER));
    if (select) select.setAttribute('d', noteRingPath(size.w, size.h, SELECT_CENTER));
  }

  function fitNoteRings(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.board-item-note').forEach(fitNoteRing);
  }

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
      el.appendChild(mountRing(ctx.doc));
      return el;
    }
  }

  View.Types.registerItem('note', ItemNote);
  View.fitNoteRings = fitNoteRings;
export { ItemNote, fitNoteRings };
