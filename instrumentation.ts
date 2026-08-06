import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Auto-captures uncaught exceptions from Route Handlers, Server Components,
// and Server Actions — no need to add try/catch to individual route handlers.
export const onRequestError = Sentry.captureRequestError;
