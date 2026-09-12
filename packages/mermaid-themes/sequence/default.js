/* Sequence color pack: default — Board grayscale + blue edges. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidSequencePacks = root.MermaidSequencePacks || {};
  root.MermaidSequencePacks.default = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    id: 'default',
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif',
    frame: { solid: '#8a8a8e', dashed: '#5c5c60' },
    themeVariables: {
      background: 'transparent',
      primaryColor: '#f7f7f7',
      primaryTextColor: '#222222',
      primaryBorderColor: '#888888',
      secondaryColor: '#eeeeee',
      tertiaryColor: '#f3f3f3',
      lineColor: '#2563eb',
      textColor: '#222222',
      mainBkg: '#f7f7f7',
      actorBkg: '#f7f7f7',
      actorBorder: '#888888',
      actorTextColor: '#222222',
      actorLineColor: '#c8c8cc',
      signalColor: '#2563eb',
      signalTextColor: '#222222',
      labelBoxBkgColor: '#ffffff',
      labelBoxBorderColor: '#888888',
      labelTextColor: '#222222',
      loopTextColor: '#222222',
      noteBkgColor: '#fff8dc',
      noteTextColor: '#222222',
      noteBorderColor: '#c4b56a',
      activationBorderColor: '#2563eb',
      activationBkgColor: '#e8eefc',
      sequenceNumberColor: '#ffffff',
    },
  };
});
