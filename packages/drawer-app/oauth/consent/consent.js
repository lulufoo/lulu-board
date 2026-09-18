/* drawer-app/oauth/consent — OAuth 2.1 consent for Cursor MCP */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function authId() {
    return new URLSearchParams(location.search).get("authorization_id") || "";
  }

  function showError(message) {
    var el = $("consent-error");
    el.hidden = !message;
    el.textContent = message || "";
  }

  function config() {
    return window.LuluBoardSupabaseConfig || {};
  }

  function client() {
    var cfg = config();
    if (!cfg.url || !cfg.publishableKey || !window.LuluBoardSupabase) return null;
    return window.LuluBoardSupabase.createClient(cfg.url, cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });
  }

  function headers(session) {
    var cfg = config();
    return {
      apikey: cfg.publishableKey,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
    };
  }

  async function authorizationGet(session, id) {
    var res = await fetch(config().url + "/auth/v1/oauth/authorizations/" + encodeURIComponent(id), {
      headers: headers(session),
    });
    var body = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(body.error_description || body.msg || body.error || "Authorization not found");
    return body;
  }

  async function authorizationConsent(session, id, action) {
    var res = await fetch(
      config().url + "/auth/v1/oauth/authorizations/" + encodeURIComponent(id) + "/consent",
      { method: "POST", headers: headers(session), body: JSON.stringify({ action: action }) }
    );
    var body = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(body.error_description || body.msg || body.error || "Consent failed");
    return body;
  }

  function leaveTo(url) {
    if (url) location.assign(url);
  }

  async function boot() {
    var id = authId();
    var signedOut = $("consent-signed-out");
    var signedIn = $("consent-signed-in");
    var cloud = client();
    if (!id) {
      showError("This link is missing an authorization id.");
      return;
    }
    if (!cloud) {
      showError("Cloud auth is not configured.");
      return;
    }

    var sessionPack = await cloud.auth.getSession();
    var session = sessionPack.data && sessionPack.data.session;
    if (!session) {
      signedOut.hidden = false;
      signedIn.hidden = true;
      return;
    }

    var userPack = await cloud.auth.getUser();
    var user = userPack.data && userPack.data.user;
    if (!user) {
      signedOut.hidden = false;
      signedIn.hidden = true;
      return;
    }

    try {
      await authorizationGet(session, id);
    } catch (error) {
      showError(error.message);
    }

    $("consent-who").textContent = "Authorize as " + (user.email || user.id) + ".";
    signedOut.hidden = true;
    signedIn.hidden = false;

    $("btn-consent-approve").onclick = function () {
      authorizationConsent(session, id, "approve").then(function (body) {
        leaveTo(body.redirect_url || body.redirectUrl);
      }).catch(function (error) { showError(error.message); });
    };
    $("btn-consent-deny").onclick = function () {
      authorizationConsent(session, id, "deny").then(function (body) {
        leaveTo(body.redirect_url || body.redirectUrl || "/");
      }).catch(function (error) { showError(error.message); });
    };
    $("btn-consent-switch").onclick = function () {
      cloud.auth.signOut().then(function () { location.reload(); });
    };
  }

  document.querySelectorAll("[data-consent-oauth]").forEach(function (button) {
    button.addEventListener("click", function () {
      var cloud = client();
      if (!cloud) return;
      var provider = button.getAttribute("data-consent-oauth") === "github" ? "github" : "google";
      cloud.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: location.href },
      }).then(function (result) {
        if (result.error) showError(result.error.message || "Sign in failed");
      });
    });
  });

  boot();
})();
