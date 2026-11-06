/* landing — read-only auth state from the local session; no Supabase on this page */
(function () {
  "use strict";

  var SESSION_KEY_RE = /^sb-.+-auth-token$/;
  var SIGN_IN_FLAG = "lulu-board:open-sign-in";

  function readStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (!key || !SESSION_KEY_RE.test(key)) continue;
        var value = JSON.parse(localStorage.getItem(key) || "null");
        if (value && (value.refresh_token || value.access_token)) return value;
      }
    } catch (_e) {}
    return null;
  }

  function showAuthState(session) {
    var signedIn = !!session;
    document.documentElement.setAttribute("data-auth", signedIn ? "in" : "out");
    var status = document.getElementById("authStatus");
    var avatar = document.getElementById("authAvatar");
    if (!status) return;
    status.setAttribute("data-state", signedIn ? "in" : "out");
    // a small circle: the email's first letter; the full address is the tooltip / accessible name
    var email = session && session.user && session.user.email;
    var label = signedIn ? (email ? "Signed in as " + email : "Signed in") : "Not signed in";
    status.title = label;
    status.setAttribute("aria-label", label);
    if (avatar) avatar.textContent = (email || "?").charAt(0).toUpperCase();
  }

  // "github" starts GitHub sign-in on the workspace; anything else opens its sign-in menu.
  function markSignInIntent(event) {
    var intent = event.currentTarget.getAttribute("data-open-sign-in") || "menu";
    try { sessionStorage.setItem(SIGN_IN_FLAG, intent); } catch (_e) {}
  }

  // copy buttons: data-copy names the element whose text goes to the clipboard
  function copyText(event) {
    var button = event.currentTarget;
    var source = document.getElementById(button.getAttribute("data-copy"));
    if (!source || !navigator.clipboard) return;
    navigator.clipboard.writeText(source.textContent.trim()).then(function () {
      button.textContent = "Copied";
      setTimeout(function () { button.textContent = "Copy"; }, 1500);
    }, function () {});
  }

  function sentryCount(name) {
    var S = window.Sentry;
    if (!S || !S.metrics || typeof S.metrics.count !== "function") return;
    if (!name) return;
    S.metrics.count(name, 1);
  }

  sentryCount("landing.view");
  showAuthState(readStoredSession());
  Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (button) {
    button.addEventListener("click", copyText);
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-open-sign-in]"), function (link) {
    link.addEventListener("click", markSignInIntent);
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-sentry-count]"), function (node) {
    node.addEventListener("click", function () {
      sentryCount(node.getAttribute("data-sentry-count"));
    });
  });
})();
