import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { clearTestDb, startTestDb, stopTestDb } from "./dbHelper";

// unstable_cache is a passthrough here; revalidateTag is a spy so we can assert
// that category edits expire the per-user summary cache.
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
}));

let categoryIdRoute: typeof import("@/app/api/categories/[id]/route");
let signJWT: typeof import("@/lib/auth").signJWT;
let summaryCacheTag: typeof import("@/lib/data/summary").summaryCacheTag;
let Category: typeof import("@/models/Category").default;

const userId = new Types.ObjectId().toString();
const otherUserId = new Types.ObjectId().toString();
let cookie = "";

beforeAll(async () => {
  await startTestDb();
  const { connectDB } = await import("@/lib/db");
  await connectDB();
  categoryIdRoute = await import("@/app/api/categories/[id]/route");
  signJWT = (await import("@/lib/auth")).signJWT;
  summaryCacheTag = (await import("@/lib/data/summary")).summaryCacheTag;
  Category = (await import("@/models/Category")).default;
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  revalidateTag.mockClear();
  cookie = `token=${await signJWT({ sub: userId, email: "u@test.dev", role: "user" }, 3600)}`;
});

afterEach(async () => {
  await clearTestDb();
});

function patch(id: string, body: unknown) {
  return categoryIdRoute.PATCH(
    new NextRequest(`http://localhost/api/categories/${id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("PATCH /api/categories/[id]", () => {
  it("expires the user's summary cache on rename", async () => {
    const cat = await Category.create({ userId, name: "Food", color: "#EF4444", sortOrder: 0 });
    const res = await patch(String(cat._id), { name: "Groceries" });
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith(summaryCacheTag(userId), { expire: 0 });
  });

  it("expires the user's summary cache on recolor", async () => {
    const cat = await Category.create({ userId, name: "Food", color: "#EF4444", sortOrder: 0 });
    const res = await patch(String(cat._id), { color: "#3B82F6" });
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith(summaryCacheTag(userId), { expire: 0 });
  });

  it("doesn't touch any cache when the category isn't the user's", async () => {
    const theirs = await Category.create({ userId: otherUserId, name: "Food", color: "#EF4444", sortOrder: 0 });
    const res = await patch(String(theirs._id), { name: "Hacked" });
    expect(res.status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
