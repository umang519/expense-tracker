import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { clearTestDb, startTestDb, stopTestDb } from "./dbHelper";

// Route handlers call revalidateTag, which needs a real Next.js request
// context — irrelevant to what's under test here.
vi.mock("next/cache", () => ({
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
  revalidateTag: vi.fn(),
}));

let budgetsRoute: typeof import("@/app/api/budgets/route");
let signJWT: typeof import("@/lib/auth").signJWT;
let Category: typeof import("@/models/Category").default;
let Budget: typeof import("@/models/Budget").default;

const userId = new Types.ObjectId().toString();
const otherUserId = new Types.ObjectId().toString();
let cookie = "";

beforeAll(async () => {
  await startTestDb();
  const { connectDB } = await import("@/lib/db");
  await connectDB();
  budgetsRoute = await import("@/app/api/budgets/route");
  signJWT = (await import("@/lib/auth")).signJWT;
  Category = (await import("@/models/Category")).default;
  Budget = (await import("@/models/Budget")).default;
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  cookie = `token=${await signJWT({ sub: userId, email: "u@test.dev", role: "user" }, 3600)}`;
});

afterEach(async () => {
  await clearTestDb();
});

function post(body: unknown) {
  return budgetsRoute.POST(
    new NextRequest("http://localhost/api/budgets", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/budgets", () => {
  it("rejects a malformed categoryId with 400, not 500", async () => {
    const res = await post({ categoryId: "not-an-id", amount: 5000 });
    expect(res.status).toBe(400);
    expect(await Budget.countDocuments()).toBe(0);
  });

  it("rejects a category that doesn't exist with 404", async () => {
    const res = await post({ categoryId: new Types.ObjectId().toString(), amount: 5000 });
    expect(res.status).toBe(404);
    expect(await Budget.countDocuments()).toBe(0);
  });

  it("rejects another user's category with 404", async () => {
    const theirs = await Category.create({ userId: otherUserId, name: "Food", color: "#EF4444", sortOrder: 0 });
    const res = await post({ categoryId: String(theirs._id), amount: 5000 });
    expect(res.status).toBe(404);
    expect(await Budget.countDocuments()).toBe(0);
  });

  it("rejects an archived category with 404", async () => {
    const archived = await Category.create({ userId, name: "Old", color: "#EF4444", sortOrder: 0, isArchived: true });
    const res = await post({ categoryId: String(archived._id), amount: 5000 });
    expect(res.status).toBe(404);
  });

  it("upserts a budget for the user's own category", async () => {
    const mine = await Category.create({ userId, name: "Food", color: "#EF4444", sortOrder: 0 });
    expect((await post({ categoryId: String(mine._id), amount: 5000 })).status).toBe(200);
    expect((await post({ categoryId: String(mine._id), amount: 7000 })).status).toBe(200);
    const budgets = await Budget.find({ userId }).lean();
    expect(budgets).toHaveLength(1);
    expect(budgets[0].amount).toBe(7000);
  });

  it("still allows the overall budget (categoryId: null)", async () => {
    const res = await post({ categoryId: null, amount: 30000 });
    expect(res.status).toBe(200);
    expect((await res.json()).budget.categoryId).toBeNull();
  });
});
