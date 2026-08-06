import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { clearTestDb, startTestDb, stopTestDb } from "./dbHelper";

// unstable_cache is coupled to a real Next.js server request context; outside
// of that it's not something to exercise here. We test our own aggregation
// logic (fetchMonthlySummary/fetchYearlySummary), not Next's cache machinery,
// so this mock makes the cached exports a transparent passthrough.
vi.mock("next/cache", () => ({
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
  revalidateTag: vi.fn(),
}));

let summary: typeof import("@/lib/data/summary");
let Category: typeof import("@/models/Category").default;
let Expense: typeof import("@/models/Expense").default;
let Budget: typeof import("@/models/Budget").default;
let Transaction: typeof import("@/models/Transaction").default;

const userId = new Types.ObjectId().toString();

beforeAll(async () => {
  await startTestDb();
  // Dynamic import: lib/db.ts reads MONGODB_URI at module-load time, so these
  // modules must load *after* startTestDb() points it at the in-memory server.
  const { connectDB } = await import("@/lib/db");
  await connectDB();
  summary = await import("@/lib/data/summary");
  Category = (await import("@/models/Category")).default;
  Expense = (await import("@/models/Expense")).default;
  Budget = (await import("@/models/Budget")).default;
  Transaction = (await import("@/models/Transaction")).default;
});

afterAll(async () => {
  await stopTestDb();
});

describe("getMonthlySummary / fetchMonthlySummary", () => {
  beforeAll(async () => {
    await clearTestDb();

    const food = await Category.create({ userId, name: "Food", color: "#F97316", sortOrder: 0 });
    const travel = await Category.create({ userId, name: "Travel", color: "#3B82F6", sortOrder: 1 });

    await Expense.create([
      { userId, date: new Date(Date.UTC(2026, 0, 5)), categoryId: food._id, amount: 100 },
      { userId, date: new Date(Date.UTC(2026, 0, 10)), categoryId: food._id, amount: 200 },
      { userId, date: new Date(Date.UTC(2026, 0, 15)), categoryId: travel._id, amount: 100 },
      // Outside the queried month — must not be included.
      { userId, date: new Date(Date.UTC(2025, 11, 31)), categoryId: food._id, amount: 999 },
    ]);

    await Budget.create([
      { userId, categoryId: null, amount: 1000 },
      { userId, categoryId: food._id, amount: 500 },
    ]);
  });

  it("computes per-category totals, percentages, and budget matching", async () => {
    const result = await summary.fetchMonthlySummary(userId, "2026-01");

    expect(result.total).toBe(400);
    expect(result.overallBudget).toMatchObject({ amount: 1000 });

    expect(result.categories).toHaveLength(2);
    const food = result.categories.find((c) => c.name === "Food");
    const travel = result.categories.find((c) => c.name === "Travel");

    expect(food).toMatchObject({ total: 300, percentage: 75 });
    expect(food?.budget).toMatchObject({ amount: 500 });
    expect(travel).toMatchObject({ total: 100, percentage: 25, budget: null });
  });

  it("the unstable_cache-wrapped export returns the same data", async () => {
    const result = await summary.getMonthlySummary(userId, "2026-01");
    expect(result.total).toBe(400);
  });

  it("returns zeroed output for a month with no expenses", async () => {
    const result = await summary.fetchMonthlySummary(userId, "2026-02");
    expect(result.total).toBe(0);
    expect(result.categories).toHaveLength(0);
  });
});

describe("getYearlySummary / fetchYearlySummary", () => {
  beforeAll(async () => {
    await clearTestDb();

    const food = await Category.create({ userId, name: "Food", color: "#F97316", sortOrder: 0 });
    const travel = await Category.create({ userId, name: "Travel", color: "#3B82F6", sortOrder: 1 });

    await Expense.create([
      { userId, date: new Date(Date.UTC(2026, 0, 5)), categoryId: food._id, amount: 100, note: "Snacks" },
      { userId, date: new Date(Date.UTC(2026, 0, 10)), categoryId: food._id, amount: 200, note: "Groceries" },
      { userId, date: new Date(Date.UTC(2026, 0, 15)), categoryId: travel._id, amount: 100 },
      { userId, date: new Date(Date.UTC(2026, 1, 5)), categoryId: food._id, amount: 50 },
      // A different year — must not be included.
      { userId, date: new Date(Date.UTC(2025, 5, 1)), categoryId: food._id, amount: 5000 },
    ]);

    await Transaction.create([
      { userId, date: new Date(Date.UTC(2026, 0, 20)), amount: 1000, type: "Cr", description: "Salary" },
      { userId, date: new Date(Date.UTC(2026, 0, 21)), amount: 200, type: "Dr", description: "Rent" },
      { userId, date: new Date(Date.UTC(2026, 0, 22)), amount: 300, type: "Dr", description: "SIP", isInvestment: true },
    ]);
  });

  it("builds a 12-row month array with per-category breakdowns", async () => {
    const result = await summary.fetchYearlySummary(userId, 2026);

    expect(result.year).toBe(2026);
    expect(result.grandTotal).toBe(450);
    expect(result.months).toHaveLength(12);

    const jan = result.months.find((m) => m.month === 1)!;
    expect(jan.label).toBe("Jan");
    expect(jan.total).toBe(400);
    expect(jan.categories).toHaveLength(2);

    const feb = result.months.find((m) => m.month === 2)!;
    expect(feb.total).toBe(50);

    const mar = result.months.find((m) => m.month === 3)!;
    expect(mar.total).toBe(0);
    expect(mar.categories).toHaveLength(0);
  });

  it("aggregates category totals across months with correct percentage and monthlyAvg", async () => {
    const result = await summary.fetchYearlySummary(userId, 2026);

    const food = result.categories.find((c) => c.name === "Food")!;
    const travel = result.categories.find((c) => c.name === "Travel")!;

    // Food: 100 + 200 + 50 = 350 across 2 active months (Jan, Feb).
    expect(food.total).toBe(350);
    expect(food.percentage).toBe(78); // round(350 / 450 * 100)
    expect(food.monthlyAvg).toBe(175); // round(350 / 2)

    // Travel: 100, only in Jan, but monthlyAvg divides by *all* active months (2), not just its own.
    expect(travel.total).toBe(100);
    expect(travel.percentage).toBe(22);
    expect(travel.monthlyAvg).toBe(50);
  });

  it("buckets transactions into received/spent/invested, by type and isInvestment", async () => {
    const result = await summary.fetchYearlySummary(userId, 2026);

    expect(result.transactions.totalReceived).toBe(1000);
    expect(result.transactions.totalSpent).toBe(200);
    expect(result.transactions.totalInvested).toBe(300);

    const jan = result.transactions.byMonth.find((m) => m.month === 1)!;
    expect(jan).toMatchObject({ received: 1000, spent: 200, invested: 300 });

    const feb = result.transactions.byMonth.find((m) => m.month === 2)!;
    expect(feb).toMatchObject({ received: 0, spent: 0, invested: 0 });
  });

  it("finds the single biggest expense of the year", async () => {
    const result = await summary.fetchYearlySummary(userId, 2026);

    expect(result.biggestExpense).toMatchObject({
      amount: 200,
      note: "Groceries",
      categoryName: "Food",
      date: "2026-01-10",
    });
  });
});
