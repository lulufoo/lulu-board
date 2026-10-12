/* Board theme pack: default. Color and chrome only — sizes live in themes/type-scale.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardThemePacks = root.BoardThemePacks || {};
  root.BoardThemePacks.default = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    id: 'default',
    label: 'Default',
    color: '#4a3524',
    edgeStroke: '#7a5c3c',
    edgeLabel: '#5a4330',
    edgeEvidence: '#aaaaaa',
    edgeFeedback: '#888888',
    bandBg: '#f5f5f5',
    bandBorder: '#bbb',
    // Shade ramp for the Fill picker, lightest first. Step 0 is the card colour; a nested Box / Item sits two steps from its parent.
    edgeRgb: '74, 53, 36', // ring and container dash colour (the ring is .22, the dash .3)
    // Fills in rotation order (see themes/rotation.js): warm paper tints.
    colors: ['#fffdf9', '#f8efe0', '#fdeee3', '#f2f3e4', '#faebe6', '#ecf1e6', '#f3ece6', '#efe9d8'],
    ramp: ['#fffdf9', '#faf6ee', '#f3ebdd', '#ece3d3', '#e2d6c2', '#d6c7ae', '#c8b696', '#b8a47e'],
    autoTone: true, // unset nested nodes follow the ramp (parent + 2); other packs keep their swatch rotation
    // Warm paper: bg = card, item = chip inside a card, card = chip straight on the canvas,
    // canvasItem = chip inside a container (on the canvas), border = container dash colour.
    swatches: [
      { bg: '#fffdf9', border: 'rgba(74, 53, 36, .3)', item: '#f3ebdd', card: '#ece3d3', canvasItem: '#ece3d3' },
    ],
    typePartials: {
      card: { radius: '12px', titleColor: '#4a3524', titleWeight: '650', cardColor: '#4a3524' },
      layout: { shell: 'hollow', pad: '0' },
      container: { shell: 'outline', borderStyle: 'dashed', pad: '16px', titleColor: '#7a6650', titleWeight: '600', cardColor: '#4a3524' },
    },
  };
});
