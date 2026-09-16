/* early head — Board-only flags before first paint */
(function () {
  document.documentElement.dataset.drawerMode = 'board';
  // Hide canvas until first transform is applied to avoid left-flash.
  document.documentElement.dataset.drawerBoot = '1';
})();
