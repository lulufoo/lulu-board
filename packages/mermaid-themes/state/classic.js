/* State color pack: classic. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MermaidStatePacks = root.MermaidStatePacks || {};
  root.MermaidStatePacks.classic = api;
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
      secondaryColor: '#e8e4ff',
      tertiaryColor: '#f3e5f5',
      lineColor: '#7e57c2',
      textColor: '#333333',
      mainBkg: '#ececff',
      nodeBorder: '#9370db',
      clusterBkg: '#f8f5ff',
      clusterBorder: '#c4b5fd',
      titleColor: '#4a148c',
      edgeLabelBackground: 'transparent',
      stateBkg: '#ececff',
      stateBorder: '#9370db',
      stateLabelColor: '#333333',
      transitionColor: '#7e57c2',
      transitionLabelColor: '#4a148c',
      labelBackgroundColor: 'transparent',
      compositeBackground: '#fbfaff',
      compositeTitleBackground: '#ececff',
      compositeBorder: '#c4b5fd',
      altBackground: '#f3e5f5',
      specialStateColor: '#4a148c',
    },
  };
});
