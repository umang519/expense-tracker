import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import RateLimitHit from "@/models/RateLimitHit";

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "local";
}

// Fixed-window counter backed by an atomic upsert (no read-then-write race —
// MongoDB guarantees single-document write atomicity). A burst straddling a
// window boundary can allow up to ~2x `limit` in a short span; accepted
// simplification for basic abuse throttling, not a precise sliding window.
export async function checkRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  // E2E runs a real app instance and must never be throttled by shared test
  // infra; set only in Playwright's webServer env, never in unit tests, so
  // lib/rateLimit.test.ts still exercises real limiting behavior.
  if (process.env.RATE_LIMIT_DISABLED === "1") return true;

  await connectDB();

  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `${scope}:${identifier}:${windowStart}`;
  const expiresAt = new Date((windowStart + 1) * windowSeconds * 1000);

  const doc = await RateLimitHit.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, new: true }
  );

  return doc.count <= limit;
}
