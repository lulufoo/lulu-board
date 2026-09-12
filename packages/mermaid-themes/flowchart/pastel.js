/* Flowchart color pack: pastel. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidFlowchartPacks = root.MermaidFlowchartPacks || {};
  root.MermaidFlowchartPacks.pastel = api;
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
      lineColor: '#64748b',
      secondaryColor: '#ecfdf5',
      tertiaryColor: '#f8fafc',
      tertiaryTextColor: '#334155',
      clusterBkg: '#f1f5f9',
      clusterBorder: '#94a3b8',
      titleColor: '#1e4f86',
      nodeTextColor: '#1e293b',
      edgeLabelBackground: '#ffffff',
      textColor: '#1e293b',
    },
  };
});
