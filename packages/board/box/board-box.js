/* Internal box base. Concrete types live in box-*.js. */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View || !View.Node) throw new Error('BoardView must load before board-box.js');

  function evidenceParts(text) {
    const raw = String(text || '').trim();
    const dash = raw.split(/\s+—\s+/, 2);
    if (dash.length > 1) return { title: dash[0], subtitle: dash[1] };
    const paren = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(raw);
    return paren ? { title: paren[1].trim(), subtitle: paren[2].trim() } : { title: raw, subtitle: '' };
  }

  class Box extends View.Node {
    roleName() { return 'box'; }
    typeName() { return 'card'; }

    decorate() {}

    contentHost(el) { return el; }

    /**
     * Content inset (applyFlex padding) must fit inside the box width/height.
     * After shell pad went to 0, an undersized frame.w lets row kids overflow
     * into padding and the 16px LR inset disappears visually.
     */
    contentInsetNeed(el) {
      if (!el || !el.querySelector) return null;
      const content = el.querySelector(':scope > .box-content');
      if (!content || content.style.display === 'none') return null;
      const cs = getComputedStyle(content);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      if (padX <= 0 && padY <= 0) return null;
      const kids = Array.from(content.children || []).filter((c) => (
        c.classList.contains('box')
        || c.classList.contains('board-zone')
        || c.classList.contains('board-item')
        || c.classList.contains('board-slot')
      ));
      if (!kids.length) return null;
      const row = String(cs.flexDirection || '').indexOf('row') === 0;
      let main = 0;
      let cross = 0;
      kids.forEach((k) => {
        const isSlot = k.classList.contains('board-slot');
        let kw = k.offsetWidth || 0;
        let kh = k.offsetHeight || 0;
        if (k.classList.contains('board-item-diamond') || k.dataset.boardShape === 'diamond') {
          kw = Math.max(kw, k.offsetWidth || 0);
          kh = Math.max(kh, k.offsetHeight || 0);
        }
        if (row) {
          main += kw;
          if (!isSlot) cross = Math.max(cross, kh);
        } else {
          main += kh;
          if (!isSlot) cross = Math.max(cross, kw);
        }
      });
      const title = el.querySelector(':scope > .box-title, :scope > .board-zone-title');
      let titleH = 0;
      if (title && getComputedStyle(title).display !== 'none') titleH = title.offsetHeight || 0;
      return {
        w: Math.ceil((row ? main : cross) + padX),
        h: Math.ceil((row ? cross : main) + padY + titleH),
      };
    }

    applyFrame(el, frame, ctx) {
      if (!el || !frame || el.dataset.boardNested === '1') {
        super.applyFrame(el, frame);
        return;
      }
      let next = frame;
      const need = this.contentInsetNeed(el);
      if (need && (need.w > frame.w + 0.5 || need.h > frame.h + 0.5)) {
        next = Object.assign({}, frame, {
          w: Math.max(frame.w, need.w),
          h: Math.max(frame.h, need.h),
        });
      }
      super.applyFrame(el, next);
      // Layout/container grow with nested kids (slots/boxes); fixed height clips
      // selection outline below the visual content (seen on REVIEW).
      const grow = !!(el.querySelector && (
        el.querySelector('.board-item, .board-card')
        || el.classList.contains('board-type-layout')
        || el.classList.contains('board-type-container')
        || el.querySelector(':scope > .box-content > .board-zone, :scope > .box-content > .box')
      ));
      if (grow) {
        el.style.minHeight = `${next.h}px`;
        el.style.height = 'auto';
      } else {
        el.style.minHeight = '';
        el.style.height = `${next.h}px`;
      }
      if (ctx && typeof ctx.afterBoxFrame === 'function') ctx.afterBoxFrame(el, next, this);
    }

    measureLive(el, base) {
      const sized = super.measureLive(el, base);
      const need = this.contentInsetNeed(el);
      if (!need) return sized;
      return {
        w: Math.max(sized.w || 0, need.w),
        h: Math.max(sized.h || 0, need.h),
        exact: sized.exact,
      };
    }

    intrinsicMinWidth() {
      return View.intrinsicBoxMinWidth(this.data);
    }

    mount(ctx) {
      const box = this.data;
      const doc = ctx.doc;
      const nested = !!ctx.nested;
      const bType = this.typeName();
      const titleOnly = !(box.items && box.items.length) && !(box.boxes && box.boxes.length);
      const el = doc.createElement('article');
      el.className = `box board-zone board-type-${bType}${nested ? ' board-nested' : ''}${titleOnly ? ' board-title-only' : ''}`;
      // Apply tone on every box (including nested) so hollow parents cannot wash out children.
      {
        const themeId = (typeof document !== 'undefined' && document.documentElement && document.documentElement.dataset.diagramTheme)
          || (ctx.root && ctx.root.dataset && ctx.root.dataset.boardTheme)
          || 'default';
        const itemN = (box.items && box.items.length) || 8;
        if (typeof root.BoardThemes !== 'undefined' && root.BoardThemes.applyBoxTone) {
          root.BoardThemes.applyBoxTone(el, themeId, bType, ctx.toneSeq.n++, itemN);
        } else {
          el.dataset.boardTone = String(ctx.toneSeq.n++);
        }
      }
      if (nested) {
        el.style.position = 'relative';
        el.style.left = '';
        el.style.top = '';
        el.style.flex = '0 0 auto';
      } else {
        el.style.position = 'absolute';
        el.style.zIndex = '1';
      }
      el.style.minWidth = nested ? 'min-content' : '0';
      el.style.maxWidth = 'none';
      el.style.width = 'max-content';
      el.style.boxSizing = 'border-box';
      el.dataset.boardId = box.id;
      el.dataset.boardKey = 'box:' + box.id;
      el.dataset.boardType = bType;
      el.dataset.boardKind = bType;
      el.dataset.boardNested = nested ? '1' : '0';
      ctx.elements.set(box.id, el);
      if (box.id === 'LOCAL') el.classList.add('board-branch-local');
      if (box.id === 'SBX') el.classList.add('board-branch-docker');
      if (box.id === 'KIT') el.classList.add('board-kit');
      this.decorate(el, ctx);
      const shell = this.contentHost(el);
      const titleParts = evidenceParts(box.title);
      const isLayout = bType === 'layout';
      const hasIcon = !isLayout && box.icon != null && box.icon !== '' && Number.isInteger(Number(box.icon));
      const boxIcon = hasIcon ? Number(box.icon) : NaN;
      const hasTitleChrome = !isLayout && (hasIcon || String(titleParts.title || '').trim() || titleParts.subtitle);
      el.classList.toggle('board-no-title', !hasTitleChrome);
      if (isLayout) {
        const halo = doc.createElement('span');
        halo.className = 'board-layout-halo';
        halo.setAttribute('aria-hidden', 'true');
        shell.appendChild(halo);
      }
      if (hasTitleChrome) {
        const title = doc.createElement('div');
        title.className = 'box-title board-zone-title';
        if (hasIcon) {
          const Icons = root.BoardIcons;
          const svg = Icons && Icons.glyph ? Icons.glyph(boxIcon) : null;
          if (svg) {
            const glyph = doc.createElement('span');
            glyph.className = 'board-zone-glyph';
            glyph.setAttribute('aria-hidden', 'true');
            glyph.innerHTML = svg;
            title.appendChild(glyph);
          }
        }
        const titleCopy = doc.createElement('span');
        titleCopy.className = 'board-title-copy';
        const titleName = doc.createElement('strong');
        titleName.className = 'board-title-name';
        titleName.textContent = titleParts.title;
        titleCopy.appendChild(titleName);
        if (titleParts.subtitle) {
          const subtitle = doc.createElement('small');
          subtitle.className = 'board-title-subtitle';
          subtitle.textContent = titleParts.subtitle;
          titleCopy.appendChild(subtitle);
        }
        title.appendChild(titleCopy);
        shell.appendChild(title);
      }
      const content = doc.createElement('div');
      content.className = 'box-content';
      const boxProps = ctx.propsFor(ctx.board, box.id);
      ctx.applyFlex(content, boxProps);
      if (titleOnly) content.style.display = 'none';
      shell.appendChild(content);
      const kids = [];
      const sourceKids = Array.isArray(box.kids) && box.kids.length
        ? box.kids
        : (box.items || []).concat(box.boxes || []);
      let itemIndex = 0;
      sourceKids.forEach((child) => {
        if (child && (child.role === 'item' || child.kind === 'item')) {
          kids.push({
            id: child.id || '',
            el: View.Types.item(child.type || 'chip', child).mount(Object.assign({}, ctx, {
              nested: true,
              parentBox: box,
              itemIndex,
            })),
          });
          itemIndex += 1;
        } else {
          kids.push({
            id: child.id || '',
            el: View.Types.wrap(child).mount(Object.assign({}, ctx, { nested: true })),
          });
        }
      });
      const useSlots = typeof ctx.makeBoardSlot === 'function';
      const dir = boxProps.direction === 'row' ? 'row' : 'column';
      kids.forEach((kid, index) => {
        if (useSlots && index > 0) {
          const slot = ctx.makeBoardSlot(dir, kids[index - 1].id, kid.id);
          if (slot) content.appendChild(slot);
        }
        content.appendChild(kid.el);
      });
      ctx.applyFlex(content, boxProps);
      return el;
    }
  }

  View.Box = Box;
  View.evidenceParts = evidenceParts;
})(typeof globalThis !== 'undefined' ? globalThis : this);
