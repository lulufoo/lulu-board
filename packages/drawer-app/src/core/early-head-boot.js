/* Early-head boot: Board-only flags before first paint; root routing to /landing. */
import * as api from './early-head.js';
import { applyGround } from './workspace-ground.js';

export function bootEarlyHead(root) {
  var host = root || (typeof globalThis !== "undefined" ? globalThis : this);
  host.DrawerEarlyHead = api.default || api;
  if (typeof document === "undefined" || typeof location === "undefined") return;
  var doc = document.documentElement;
  var storage = api.safeStorage(host);
  var ctx = {
    pathname: location.pathname,
    hash: location.hash,
    search: location.search,
    storage: storage,
  };
  if (api.shouldShowLanding(ctx)) {
    location.replace(api.LANDING_PATH);
    return;
  }
  doc.dataset.drawerMode = "diagram";
  applyGround(doc);
  doc.dataset.drawerBoot = "1";
  var plan = api.blankStartPlan(ctx);
  if (!plan) return;
  var next = location.pathname + location.search;
  if (plan.hash) next += "#" + plan.hash;
  if (next !== location.pathname + location.search + location.hash) {
    if (typeof history !== "undefined" && typeof history.replaceState === "function") {
      history.replaceState(null, "", next);
    } else if (plan.hash) {
      location.hash = plan.hash;
    }
  }
  if (plan.openDrawer) doc.dataset.blankStartDrawer = "1";
  if (plan.pickKind) doc.dataset.blankStartKind = "1";
}

bootEarlyHead();
