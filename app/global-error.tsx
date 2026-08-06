"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Replaces the root layout entirely when an error escapes every other
// boundary, so it must render its own <html>/<body> per the App Router
// global-error contract.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased bg-white dark:bg-gray-950">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            We&apos;ve been notified and are looking into it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
