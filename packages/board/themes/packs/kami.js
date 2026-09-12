/* Board theme pack: kami. Color and chrome only — sizes live in themes/type-scale.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardThemePacks = root.BoardThemePacks || {};
  root.BoardThemePacks.kami = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ink = '#1B365D';
  const ivory = '#faf9f5';
  const sand = '#ebe6d6';
  const border = '#6b6a64';

  return {
    id: 'kami',
    label: 'Kami',
    fontFamily: '"Songti SC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", Palatino, Georgia, "Times New Roman", serif',
    color: '#141413',
    edgeStroke: ink,
    edgeEvidence: '#6b6a64',
    edgeFeedback: ink,
    bandBg: '#f5f4ed',
    bandBorder: border,
    swatches: [
      { bg: ivory, border: border, item: sand, card: ivory },
    ],
    typePartials: {
      card: { radius: '3px', titleColor: '#141413', titleWeight: '600', cardColor: '#141413' },
      layout: { shell: 'hollow', pad: '0' },
      container: { shell: 'outline', borderStyle: 'dashed', pad: '16px', titleColor: '#141413', titleWeight: '600', cardColor: '#141413' },
    },
  };
});
