import * as Sentry from "@sentry/nextjs";

// Covers proxy.ts (edge middleware). SENTRY_DSN unset -> SDK no-ops safely.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
