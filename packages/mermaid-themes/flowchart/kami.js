/* Flowchart color pack: kami. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidFlowchartPacks = root.MermaidFlowchartPacks || {};
  root.MermaidFlowchartPacks.kami = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    id: 'kami',
    fontFamily: '"Songti SC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", Palatino, Georgia, serif',
    themeVariables: {
      background: 'transparent',
      primaryColor: '#faf9f5',
      primaryTextColor: '#141413',
      primaryBorderColor: '#6b6a64',
      lineColor: '#1B365D',
      secondaryColor: '#ebe6d6',
      tertiaryColor: '#f5f4ed',
      tertiaryTextColor: '#141413',
      clusterBkg: '#f5f4ed',
      clusterBorder: '#6b6a64',
      titleColor: '#141413',
      nodeTextColor: '#141413',
      edgeLabelBackground: '#faf9f5',
      textColor: '#141413',
    },
  };
});
