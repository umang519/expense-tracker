import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env.test.local") });

const PORT = 3006;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Both specs log in as the same seeded test user and mutate its data
  // (adding/editing/deleting expenses) — run serially to avoid cross-test races.
  fullyParallel: false,
  workers: 1,
  // These specs hit a real dev server and real DB round trips, not mocks —
  // one retry absorbs the occasional transient network/DB blip rather than
  // treating a single slow response as a hard failure.
  retries: 1,
  reporter: "list",
  // next dev (Turbopack) compiles each route on first request, not ahead of
  // time — generous headroom over Playwright's 30s default so a cold run
  // isn't flaky while routes warm up.
  timeout: 90_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  // Generous default for expect() polling — this suite hits a real dev server
  // and a real DB round trip per assertion, not a static page.
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      // App is mobile-first (design target ~380px up per CLAUDE.md) — test
      // the primary viewport, not desktop.
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      MONGODB_URI: process.env.MONGODB_URI ?? "",
      JWT_SECRET: process.env.JWT_SECRET ?? "",
      // Auth routes are rate-limited by IP; E2E runs from one machine and
      // must never be throttled by that shared infra (see lib/rateLimit.ts).
      RATE_LIMIT_DISABLED: "1",
    },
  },
});
