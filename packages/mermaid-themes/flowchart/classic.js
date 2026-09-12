/* Flowchart color pack: classic. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidFlowchartPacks = root.MermaidFlowchartPacks || {};
  root.MermaidFlowchartPacks.classic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    id: 'classic',
    fontFamily: '"Trebuchet MS", Verdana, Arial, sans-serif',
    themeVariables: {
      background: 'transparent',
      primaryColor: '#ececff',
      primaryTextColor: '#333333',
      primaryBorderColor: '#9370db',
      lineColor: '#7e57c2',
      secondaryColor: '#e8e4ff',
      tertiaryColor: '#f3e5f5',
      tertiaryTextColor: '#4a148c',
      clusterBkg: '#f5f3ff',
      clusterBorder: '#8b5cf6',
      titleColor: '#4a148c',
      nodeTextColor: '#333333',
      edgeLabelBackground: '#ffffff',
      textColor: '#333333',
    },
  };
});
