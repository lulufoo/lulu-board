/* State color pack: default — Cursor-like grayscale + soft edges. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidStatePacks = root.MermaidStatePacks || {};
  root.MermaidStatePacks.default = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    id: 'default',
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif',
    themeVariables: {
      background: 'transparent',
      primaryColor: '#f4f4f5',
      primaryTextColor: '#18181b',
      primaryBorderColor: '#a1a1aa',
      secondaryColor: '#eeeeef',
      tertiaryColor: '#fafafa',
      tertiaryTextColor: '#3f3f46',
      lineColor: '#52525b',
      textColor: '#18181b',
      mainBkg: '#f4f4f5',
      nodeBorder: '#a1a1aa',
      clusterBkg: '#fafafa',
      clusterBorder: '#d4d4d8',
      titleColor: '#18181b',
      edgeLabelBackground: 'transparent',
      /* state-specific */
      stateBkg: '#f4f4f5',
      stateBorder: '#a1a1aa',
      stateLabelColor: '#18181b',
      transitionColor: '#52525b',
      transitionLabelColor: '#3f3f46',
      labelBackgroundColor: 'transparent',
      compositeBackground: '#ffffff',
      compositeTitleBackground: '#f4f4f5',
      compositeBorder: '#d4d4d8',
      altBackground: '#fafafa',
      specialStateColor: '#18181b',
    },
  };
});
