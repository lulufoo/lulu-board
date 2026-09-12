/* State color pack: pastel. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidStatePacks = root.MermaidStatePacks || {};
  root.MermaidStatePacks.pastel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    id: 'pastel',
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif',
    themeVariables: {
      background: 'transparent',
      primaryColor: '#eff6ff',
      primaryTextColor: '#1e293b',
      primaryBorderColor: '#60a5fa',
      secondaryColor: '#ecfdf5',
      tertiaryColor: '#f8fafc',
      lineColor: '#64748b',
      textColor: '#1e293b',
      mainBkg: '#eff6ff',
      nodeBorder: '#60a5fa',
      clusterBkg: '#f8fafc',
      clusterBorder: '#cbd5e1',
      titleColor: '#1e4f86',
      edgeLabelBackground: 'transparent',
      stateBkg: '#eff6ff',
      stateBorder: '#60a5fa',
      stateLabelColor: '#1e293b',
      transitionColor: '#64748b',
      transitionLabelColor: '#334155',
      labelBackgroundColor: 'transparent',
      compositeBackground: '#ffffff',
      compositeTitleBackground: '#eff6ff',
      compositeBorder: '#cbd5e1',
      altBackground: '#f1f5f9',
      specialStateColor: '#1e293b',
    },
  };
});
