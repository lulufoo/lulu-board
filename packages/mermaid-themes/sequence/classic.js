/* Sequence color pack: classic. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidSequencePacks = root.MermaidSequencePacks || {};
  root.MermaidSequencePacks.classic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    id: 'classic',
    fontFamily: '"Trebuchet MS", Verdana, Arial, sans-serif',
    frame: { solid: '#8b5cf6', dashed: '#6d28d9' },
    themeVariables: {
      background: 'transparent',
      primaryColor: '#ececff',
      primaryTextColor: '#333333',
      primaryBorderColor: '#9370db',
      secondaryColor: '#e8e4ff',
      tertiaryColor: '#f3e5f5',
      lineColor: '#7e57c2',
      textColor: '#333333',
      mainBkg: '#ececff',
      actorBkg: '#ececff',
      actorBorder: '#9370db',
      actorTextColor: '#333333',
      actorLineColor: '#c4b5fd',
      signalColor: '#7e57c2',
      signalTextColor: '#333333',
      labelBoxBkgColor: '#ffffff',
      labelBoxBorderColor: '#9370db',
      labelTextColor: '#4a148c',
      loopTextColor: '#4a148c',
      noteBkgColor: '#fef3c7',
      noteTextColor: '#333333',
      noteBorderColor: '#d4a017',
      activationBorderColor: '#7e57c2',
      activationBkgColor: '#ede9fe',
      sequenceNumberColor: '#ffffff',
    },
  };
});
