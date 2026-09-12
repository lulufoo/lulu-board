/* Chip diamond frame. Not a box type.
 * The chip host is a transparent flex frame. Keep it. The rhombus is
 * an overlay inside that frame and stays content-sized and centered.
 * Do not drop the host or paint the rhombus as the stretched box. */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View) throw new Error('BoardView must load before box-diamond.js');

  const DIAMOND_ASPECT = 1.4;
  const DIAMOND_MIN_W = 96;
  const TEXT_CHORD = 0.56;

  function isDiamondEl(el) {
    return !!(el && (
      el.classList.contains('board-item-diamond')
      || el.dataset.boardShape === 'diamond'
    ));
  }

  function decorateChipDiamond(el, item, ctx) {
    if (!el) return;
    // `el` is the transparent host. Required. Do not unwrap or delete it.
    el.classList.add('board-item-diamond');
    el.dataset.boardShape = 'diamond';
    el.style.background = 'transparent';
    el.style.border = '0';
    el.style.borderRadius = '0';
    el.style.boxShadow = 'none';
    el.style.overflow = 'visible';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.alignSelf = 'auto';
    el.style.flex = '0 0 auto';
    el.style.gap = '0';
    const doc = (ctx && ctx.doc) || el.ownerDocument;
    const visual = doc.createElement('div');
    visual.className = 'board-item-diamond-visual';
    visual.style.position = 'absolute';
    visual.style.left = '0';
    visual.style.top = '0';
    visual.style.pointerEvents = 'none';
    visual.style.overflow = 'visible';
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('board-item-diamond-shape');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('shape-rendering', 'geometricPrecision');
    svg.setAttribute('width', '96');
    svg.setAttribute('height', '69');
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '96px';
    svg.style.height = '69px';
    svg.style.overflow = 'visible';
    svg.style.display = 'block';
    const halo = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    halo.classList.add('board-item-diamond-halo');
    halo.setAttribute('points', '50,-1.8 101.8,50 50,101.8 -1.8,50');
    halo.setAttribute('fill', 'none');
    halo.setAttribute('stroke', '#f59e0b');
    halo.setAttribute('stroke-width', '3');
    halo.setAttribute('stroke-linejoin', 'miter');
    halo.setAttribute('vector-effect', 'non-scaling-stroke');
    const polygon = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.classList.add('board-item-diamond-face');
    polygon.setAttribute('points', '50,0 100,50 50,100 0,50');
    const themeId = (typeof document !== 'undefined' && document.documentElement && document.documentElement.dataset.diagramTheme) || 'default';
    const theme = root.BoardThemes && root.BoardThemes.get ? root.BoardThemes.get(themeId) : null;
    const kit = root.BoardThemes && root.BoardThemes.kitFor ? root.BoardThemes.kitFor(themeId, 'card', 0, 1) : null;
    polygon.setAttribute('fill', (kit && kit.cardBg) || '#fff');
    polygon.setAttribute('stroke', (kit && kit.cardBorder) || (theme && theme.edgeStroke) || '#9370db');
    polygon.setAttribute('stroke-width', '1.5');
    polygon.setAttribute('stroke-linejoin', 'miter');
    polygon.setAttribute('stroke-miterlimit', '8');
    polygon.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(halo);
    svg.appendChild(polygon);
    visual.appendChild(svg);
    el.style.position = el.classList.contains('board-root-item') ? 'absolute' : 'relative';
    el.insertBefore(visual, el.firstChild);
  }

  function hostSlotWidth(el) {
    if (!el) return 0;
    return el.clientWidth || el.offsetWidth || 0;
  }

  function stashCopyMeasure(copy, text) {
    return {
      copyPos: copy ? copy.style.position : '',
      copyLeft: copy ? copy.style.left : '',
      copyTop: copy ? copy.style.top : '',
      copyW: copy ? copy.style.width : '',
      copyH: copy ? copy.style.height : '',
      copyMax: copy ? copy.style.maxWidth : '',
      copyPad: copy ? copy.style.padding : '',
      copyDisplay: copy ? copy.style.display : '',
      copyWrap: copy ? copy.style.whiteSpace : '',
      copyOverflow: copy ? copy.style.overflowWrap : '',
      textW: text ? text.style.width : '',
      textMax: text ? text.style.maxWidth : '',
      textWrap: text ? text.style.whiteSpace : '',
      textOverflow: text ? text.style.overflowWrap : '',
    };
  }

  function restoreCopyMeasure(copy, text, prev) {
    if (copy) {
      copy.style.position = prev.copyPos;
      copy.style.left = prev.copyLeft;
      copy.style.top = prev.copyTop;
      copy.style.width = prev.copyW;
      copy.style.height = prev.copyH;
      copy.style.maxWidth = prev.copyMax;
      copy.style.padding = prev.copyPad;
      copy.style.display = prev.copyDisplay;
      copy.style.whiteSpace = prev.copyWrap;
      copy.style.overflowWrap = prev.copyOverflow;
    }
    if (text) {
      text.style.width = prev.textW;
      text.style.maxWidth = prev.textMax;
      text.style.whiteSpace = prev.textWrap;
      text.style.overflowWrap = prev.textOverflow;
    }
  }

  function readCopyExtent(copy, text) {
    const w = copy ? Math.max(copy.scrollWidth, copy.offsetWidth, text ? text.scrollWidth : 0, 36) : 36;
    const h = copy ? Math.max(copy.scrollHeight, text ? text.scrollHeight : 0, 16) : 16;
    return { w, h };
  }

  function prepareCopyMeasure(copy, text, boxed) {
    if (!copy) return;
    copy.style.position = 'static';
    copy.style.left = '';
    copy.style.top = '';
    copy.style.height = 'auto';
    copy.style.padding = '0';
    copy.style.overflowWrap = 'anywhere';
    if (text) {
      text.style.overflowWrap = 'anywhere';
      text.style.whiteSpace = 'pre-wrap';
    }
    if (boxed > 0) {
      copy.style.display = 'block';
      copy.style.width = boxed + 'px';
      copy.style.maxWidth = boxed + 'px';
      copy.style.whiteSpace = 'pre-wrap';
      if (text) {
        text.style.width = '100%';
        text.style.maxWidth = '100%';
      }
      return;
    }
    copy.style.display = 'inline-block';
    copy.style.width = 'auto';
    copy.style.maxWidth = 'none';
    copy.style.whiteSpace = 'pre';
    if (text) {
      text.style.width = 'auto';
      text.style.maxWidth = 'none';
      text.style.whiteSpace = 'pre';
    }
  }

  function contentDiamondSize(el, capW) {
    const copy = el && el.querySelector && el.querySelector('.board-item-copy');
    const text = copy && copy.querySelector('.board-item-text');
    const slot = Number.isFinite(capW) && capW > 0 ? capW : hostSlotWidth(el);
    const maxVis = slot > 0 ? Math.round(slot) : 0;
    const prev = stashCopyMeasure(copy, text);
    prepareCopyMeasure(copy, text, 0);
    const intrinsic = readCopyExtent(copy, text);
    let w = Math.max(DIAMOND_MIN_W, Math.ceil(intrinsic.w / TEXT_CHORD));
    let h = Math.max(Math.ceil(w / DIAMOND_ASPECT), Math.ceil(intrinsic.h / TEXT_CHORD));
    if (maxVis > 0 && w > maxVis) {
      const textCap = Math.max(36, Math.floor(maxVis * TEXT_CHORD));
      prepareCopyMeasure(copy, text, textCap);
      const wrapped = readCopyExtent(copy, text);
      w = maxVis;
      h = Math.max(Math.ceil(maxVis / DIAMOND_ASPECT), Math.ceil(wrapped.h / TEXT_CHORD));
    }
    restoreCopyMeasure(copy, text, prev);
    return { w, h };
  }

  function measureChipDiamond(el, base) {
    const cap = el && el.classList.contains('board-root-item')
      ? (base && base.w) || hostSlotWidth(el)
      : hostSlotWidth(el);
    const need = el ? contentDiamondSize(el, cap) : { w: DIAMOND_MIN_W, h: DIAMOND_MIN_W / DIAMOND_ASPECT };
    return { w: need.w, h: need.h, exact: true, base };
  }

  function diamondGeomEl(el) {
    if (!el || !el.querySelector) return el;
    return el.querySelector('.board-item-diamond-visual, .board-diamond-visual') || el;
  }

  function placeChipDiamondOverlay(el, visual, copy, need, fill) {
    const w = Math.round(need.w);
    const h = Math.round(need.h);
    const hostW = el.clientWidth || w;
    const hostH = el.clientHeight || h;
    const left = fill ? 0 : Math.round((hostW - w) / 2);
    const top = fill ? 0 : Math.round((hostH - h) / 2);
    if (visual) {
      visual.style.position = 'absolute';
      visual.style.pointerEvents = 'none';
      visual.style.overflow = 'visible';
      visual.style.transform = 'none';
      visual.style.inset = fill ? '0' : 'auto';
      visual.style.left = fill ? '0' : left + 'px';
      visual.style.top = fill ? '0' : top + 'px';
      visual.style.right = fill ? '0' : 'auto';
      visual.style.bottom = fill ? '0' : 'auto';
      visual.style.width = fill ? '100%' : w + 'px';
      visual.style.height = fill ? '100%' : h + 'px';
      const svg = visual.querySelector('.board-item-diamond-shape');
      if (svg) {
        const svgW = fill ? (el.clientWidth || w) : w;
        const svgH = fill ? (el.clientHeight || h) : h;
        svg.setAttribute('width', String(svgW));
        svg.setAttribute('height', String(svgH));
        svg.style.position = 'absolute';
        svg.style.left = '0';
        svg.style.top = '0';
        svg.style.right = 'auto';
        svg.style.bottom = 'auto';
        svg.style.width = svgW + 'px';
        svg.style.height = svgH + 'px';
        svg.style.overflow = 'visible';
        svg.style.display = 'block';
      }
    }
    if (!copy) return;
    copy.style.position = 'absolute';
    copy.style.zIndex = '1';
    copy.style.inset = fill ? '0' : 'auto';
    copy.style.left = fill ? '0' : left + 'px';
    copy.style.top = fill ? '0' : top + 'px';
    copy.style.right = fill ? '0' : 'auto';
    copy.style.bottom = fill ? '0' : 'auto';
    copy.style.width = fill ? 'auto' : w + 'px';
    copy.style.height = fill ? 'auto' : h + 'px';
    copy.style.maxWidth = fill ? 'none' : w + 'px';
    copy.style.margin = '0';
    copy.style.whiteSpace = 'pre-wrap';
    copy.style.overflowWrap = 'anywhere';
    copy.style.padding = '0 ' + Math.round((fill ? hostW : w) * (1 - TEXT_CHORD) / 2) + 'px';
    const text = copy.querySelector && copy.querySelector('.board-item-text');
    if (text) {
      text.style.whiteSpace = 'pre-wrap';
      text.style.overflowWrap = 'anywhere';
      text.style.width = '100%';
      text.style.maxWidth = '100%';
      text.style.textAlign = 'center';
    }
    copy.style.boxSizing = 'border-box';
    copy.style.display = 'flex';
    copy.style.flexDirection = 'column';
    copy.style.alignItems = 'center';
    copy.style.justifyContent = 'center';
    copy.style.textAlign = 'center';
    copy.style.lineHeight = '1.1';
    copy.style.pointerEvents = 'none';
  }

  function paintChipDiamondFromCard(el) {
    const face = el && el.querySelector && el.querySelector('.board-item-diamond-face');
    if (!face) return;
    el.style.removeProperty('background');
    el.style.removeProperty('border');
    el.style.removeProperty('box-shadow');
    el.classList.add('is-measuring-chip-fill');
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    const fill = cs.backgroundColor;
    const stroke = cs.borderColor;
    el.classList.remove('is-measuring-chip-fill');
    el.style.setProperty('background', 'transparent', 'important');
    el.style.setProperty('border', '0', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    if (fill && fill !== 'transparent' && fill !== 'rgba(0, 0, 0, 0)') {
      face.setAttribute('fill', fill);
    }
    if (stroke && stroke !== 'transparent' && stroke !== 'rgba(0, 0, 0, 0)') {
      face.setAttribute('stroke', stroke);
    }
  }

  function parentCrossStretch(el) {
    const content = el && el.parentElement;
    if (!content || !content.classList.contains('box-content')) return false;
    const view = content.ownerDocument && content.ownerDocument.defaultView;
    if (!view) return false;
    return view.getComputedStyle(content).alignItems === 'stretch';
  }

  function fitChipDiamonds(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.board-item-diamond').forEach((el) => {
      const slot = hostSlotWidth(el);
      const need = contentDiamondSize(el, slot);
      const visual = el.querySelector('.board-item-diamond-visual');
      const copy = el.querySelector('.board-item-copy');
      const rootItem = el.classList.contains('board-root-item');
      const stretchHost = !rootItem && parentCrossStretch(el);
      el.style.boxSizing = 'border-box';
      el.style.alignSelf = 'auto';
      el.style.flex = '0 0 auto';
      if (!rootItem) {
        el.style.height = Math.round(need.h) + 'px';
        el.style.minHeight = Math.round(need.h) + 'px';
        el.style.maxHeight = Math.round(need.h) + 'px';
        if (stretchHost) {
          el.style.width = '';
          el.style.minWidth = '';
          el.style.maxWidth = '';
        } else {
          el.style.width = Math.round(need.w) + 'px';
          el.style.minWidth = Math.round(need.w) + 'px';
          el.style.maxWidth = Math.round(need.w) + 'px';
        }
      }
      placeChipDiamondOverlay(el, visual, copy, need, rootItem);
      paintChipDiamondFromCard(el);
    });
  }

  View.isDiamondEl = isDiamondEl;
  View.diamondGeomEl = diamondGeomEl;
  View.decorateChipDiamond = decorateChipDiamond;
  View.measureChipDiamond = measureChipDiamond;
  View.fitChipDiamonds = fitChipDiamonds;
})(typeof globalThis !== 'undefined' ? globalThis : this);
