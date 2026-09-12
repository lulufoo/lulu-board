/* Sequence color pack: kami — ivory paper + navy ink. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidSequencePacks = root.MermaidSequencePacks || {};
  root.MermaidSequencePacks.kami = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ink = '#1B365D';
  return {
    id: 'kami',
    fontFamily: '"Songti SC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", Palatino, Georgia, serif',
    frame: { solid: '#6b6a64', dashed: ink },
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
      actorBkg: '#faf9f5',
      actorBorder: '#6b6a64',
      actorTextColor: '#141413',
      actorLineColor: '#c9c4b4',
      signalColor: ink,
      signalTextColor: '#141413',
      labelBoxBkgColor: '#faf9f5',
      labelBoxBorderColor: '#6b6a64',
      labelTextColor: '#141413',
      loopTextColor: '#141413',
      noteBkgColor: '#ebe6d6',
      noteTextColor: '#141413',
      noteBorderColor: '#6b6a64',
      activationBorderColor: ink,
      activationBkgColor: '#ebe6d6',
      sequenceNumberColor: '#faf9f5',
    },
  };
});
