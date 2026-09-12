/* Flowchart color pack: default. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidFlowchartPacks = root.MermaidFlowchartPacks || {};
  root.MermaidFlowchartPacks.default = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    id: 'default',
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif',
    themeVariables: {
      background: 'transparent',
      primaryColor: '#f7f7f7',
      primaryTextColor: '#222222',
      primaryBorderColor: '#888888',
      lineColor: '#2563eb',
      secondaryColor: '#eeeeee',
      tertiaryColor: '#f3f3f3',
      tertiaryTextColor: '#333333',
      clusterBkg: '#f5f5f5',
      clusterBorder: '#bbbbbb',
      titleColor: '#222222',
      nodeTextColor: '#222222',
      edgeLabelBackground: '#ffffff',
      textColor: '#222222',
    },
  };
});
