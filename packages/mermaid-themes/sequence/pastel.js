/* Sequence color pack: pastel. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidSequencePacks = root.MermaidSequencePacks || {};
  root.MermaidSequencePacks.pastel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    id: 'pastel',
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif',
    frame: { solid: '#94a3b8', dashed: '#64748b' },
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
      actorBkg: '#eff6ff',
      actorBorder: '#60a5fa',
      actorTextColor: '#1e293b',
      actorLineColor: '#cbd5e1',
      signalColor: '#64748b',
      signalTextColor: '#1e293b',
      labelBoxBkgColor: '#ffffff',
      labelBoxBorderColor: '#94a3b8',
      labelTextColor: '#1e4f86',
      loopTextColor: '#1e4f86',
      noteBkgColor: '#ecfdf5',
      noteTextColor: '#1e293b',
      noteBorderColor: '#6ee7b7',
      activationBorderColor: '#60a5fa',
      activationBkgColor: '#dbeafe',
      sequenceNumberColor: '#ffffff',
    },
  };
});
