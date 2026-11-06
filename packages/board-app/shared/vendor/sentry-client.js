import * as Sentry from "@sentry/browser";
var dsn = window.LuluBoardSentryConfig && window.LuluBoardSentryConfig.dsn;
if (dsn) Sentry.init({ dsn: dsn, defaultIntegrations: false, tracesSampleRate: 1 });
window.Sentry = Sentry;
