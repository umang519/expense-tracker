import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearTestDb, startTestDb, stopTestDb } from "../tests/integration/dbHelper";

let checkRateLimit: typeof import("./rateLimit").checkRateLimit;

beforeAll(async () => {
  await startTestDb();
  // Dynamic import: lib/db.ts reads MONGODB_URI at module-load time.
  ({ checkRateLimit } = await import("./rateLimit"));
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    expect(await checkRateLimit("test-scope", "1.2.3.4", 3, 60)).toBe(true);
    expect(await checkRateLimit("test-scope", "1.2.3.4", 3, 60)).toBe(true);
    expect(await checkRateLimit("test-scope", "1.2.3.4", 3, 60)).toBe(true);
  });

  it("blocks requests once the limit is exceeded", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimit("test-scope", "5.6.7.8", 3, 60)).toBe(true);
    }
    expect(await checkRateLimit("test-scope", "5.6.7.8", 3, 60)).toBe(false);
  });

  it("tracks separate identifiers independently", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("test-scope", "9.9.9.9", 3, 60);
    }
    expect(await checkRateLimit("test-scope", "9.9.9.9", 3, 60)).toBe(false);
    // A different IP under the same scope has its own fresh budget.
    expect(await checkRateLimit("test-scope", "1.1.1.1", 3, 60)).toBe(true);
  });

  it("tracks separate scopes independently for the same identifier", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("login", "2.2.2.2", 3, 60);
    }
    expect(await checkRateLimit("login", "2.2.2.2", 3, 60)).toBe(false);
    expect(await checkRateLimit("register", "2.2.2.2", 3, 60)).toBe(true);
  });

  it("does not over-count under concurrent calls", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkRateLimit("concurrent", "3.3.3.3", 5, 60))
    );
    const allowed = results.filter(Boolean).length;
    expect(allowed).toBe(5);
  });
});
