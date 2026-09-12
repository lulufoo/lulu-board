/* State color pack: kami — ivory paper + navy ink. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidStatePacks = root.MermaidStatePacks || {};
  root.MermaidStatePacks.kami = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ink = '#1B365D';
  return {
    id: 'kami',
    fontFamily: '"Songti SC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", Palatino, Georgia, serif',
    themeVariables: {
      background: 'transparent',
      primaryColor: '#faf9f5',
      primaryTextColor: '#141413',
      primaryBorderColor: '#6b6a64',
      secondaryColor: '#ebe6d6',
      tertiaryColor: '#f5f4ed',
      lineColor: ink,
      textColor: '#141413',
      mainBkg: '#faf9f5',
      nodeBorder: '#6b6a64',
      clusterBkg: '#f5f4ed',
      clusterBorder: '#c9c4b4',
      titleColor: '#141413',
      edgeLabelBackground: 'transparent',
      stateBkg: '#faf9f5',
      stateBorder: '#6b6a64',
      stateLabelColor: '#141413',
      transitionColor: ink,
      transitionLabelColor: '#141413',
      labelBackgroundColor: 'transparent',
      compositeBackground: '#ffffff',
      compositeTitleBackground: '#ebe6d6',
      compositeBorder: '#c9c4b4',
      altBackground: '#f5f4ed',
      specialStateColor: ink,
    },
  };
});
