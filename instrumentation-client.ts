import * as Sentry from "@sentry/nextjs";

// NEXT_PUBLIC_ prefix required so this reaches the browser bundle.
// Unset in local dev by default — the SDK safely no-ops without a DSN.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
