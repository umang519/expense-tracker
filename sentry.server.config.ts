import * as Sentry from "@sentry/nextjs";

// SENTRY_DSN is unset in local dev by default — the SDK safely no-ops without
// throwing when dsn is undefined, so this file works before a real DSN exists.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
