import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { clearTestDb, startTestDb, stopTestDb } from "./dbHelper";

// Route handlers call revalidateTag, which needs a real Next.js request
// context — irrelevant to what's under test here (which expenses get created).
vi.mock("next/cache", () => ({
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
  revalidateTag: vi.fn(),
}));

let recurringRoute: typeof import("@/app/api/recurring/route");
let recurringIdRoute: typeof import("@/app/api/recurring/[id]/route");
let generateRoute: typeof import("@/app/api/recurring/generate/route");
let signJWT: typeof import("@/lib/auth").signJWT;
let Category: typeof import("@/models/Category").default;
let Expense: typeof import("@/models/Expense").default;

const userId = new Types.ObjectId().toString();
const otherUserId = new Types.ObjectId().toString();
let cookie = "";
let categoryId = "";

beforeAll(async () => {
  await startTestDb();
  const { connectDB } = await import("@/lib/db");
  await connectDB();
  recurringRoute = await import("@/app/api/recurring/route");
  recurringIdRoute = await import("@/app/api/recurring/[id]/route");
  generateRoute = await import("@/app/api/recurring/generate/route");
  signJWT = (await import("@/lib/auth")).signJWT;
  Category = (await import("@/models/Category")).default;
  Expense = (await import("@/models/Expense")).default;
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  // Fake only Date — the Mongo driver needs real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  setToday("2026-07-01");
  cookie = `token=${await signJWT({ sub: userId, email: "u@test.dev", role: "user" }, 10 * 365 * 86400)}`;
  const cat = await Category.create({ userId, name: "Travel", color: "#3B82F6", sortOrder: 0 });
  categoryId = String(cat._id);
});

afterEach(async () => {
  vi.useRealTimers();
  await clearTestDb();
});

// Midday UTC so "today" is the same calendar day in UTC and IST.
function setToday(ymd: string) {
  vi.setSystemTime(new Date(`${ymd}T06:00:00.000Z`));
}

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createTemplate(body: Record<string, unknown>): Promise<string> {
  const res = await recurringRoute.POST(req("/api/recurring", "POST", body));
  expect(res.status).toBe(201);
  return String((await res.json()).recurring._id);
}

async function patchTemplate(id: string, body: Record<string, unknown>) {
  return recurringIdRoute.PATCH(req(`/api/recurring/${id}`, "PATCH", body), {
    params: Promise.resolve({ id }),
  });
}

async function generate(): Promise<number> {
  const res = await generateRoute.POST(req("/api/recurring/generate", "POST"));
  return (await res.json()).generated;
}

function weekdaysBetween(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${fromYmd}T00:00:00Z`); d <= new Date(`${toYmd}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function expenseDates(amount?: number): Promise<string[]> {
  const docs = await Expense.find(amount === undefined ? { userId } : { userId, amount }).sort({ date: 1 }).lean();
  return docs.map((e) => e.date.toISOString().slice(0, 10));
}

describe("recurring expenses — editing a running template", () => {
  // The user-reported scenario: weekdays ₹65 started months ago; changing just
  // the amount (the edit form always re-sends the unchanged startDate) must
  // only affect future entries, never re-log the past.
  it("changing only the amount does not re-generate already-logged days", async () => {
    const id = await createTemplate({ categoryId, amount: 65, frequency: "weekdays", startDate: "2026-07-01" });

    setToday("2026-09-25"); // Friday
    const firstRun = await generate();
    expect(firstRun).toBe(weekdaysBetween("2026-07-01", "2026-09-25").length);

    // Edit form sends every field, including the unchanged startDate.
    const res = await patchTemplate(id, { amount: 56, startDate: "2026-07-01", frequency: "weekdays", categoryId });
    expect(res.status).toBe(200);

    expect(await generate()).toBe(0);
    expect(await expenseDates(56)).toEqual([]);

    // Going forward, new days use the new amount.
    setToday("2026-10-02"); // following Friday
    expect(await generate()).toBe(5);
    expect(await expenseDates(56)).toEqual(weekdaysBetween("2026-09-28", "2026-10-02"));
    expect(await expenseDates(65)).toEqual(weekdaysBetween("2026-07-01", "2026-09-25"));
  });

  it("moving the start date later does not re-log days already logged", async () => {
    const id = await createTemplate({ categoryId, amount: 65, frequency: "weekdays", startDate: "2026-07-01" });
    setToday("2026-09-25");
    await generate();

    setToday("2026-10-02");
    await patchTemplate(id, { amount: 56, startDate: "2026-09-20" });
    expect(await generate()).toBe(5); // only Sep 28 – Oct 2, nothing from Sep 20–25 again

    const all = await expenseDates();
    expect(new Set(all).size).toBe(all.length); // no day logged twice
  });

  it("moving the start date into the future pauses generation until then", async () => {
    const id = await createTemplate({ categoryId, amount: 65, frequency: "weekdays", startDate: "2026-07-01" });
    setToday("2026-07-03");
    await generate();

    await patchTemplate(id, { startDate: "2026-07-20" });
    setToday("2026-07-17");
    expect(await generate()).toBe(0);

    setToday("2026-07-21");
    expect(await generate()).toBe(2); // Jul 20, 21
  });

  it("monthly and weekly templates also don't replay history on edit", async () => {
    const monthly = await createTemplate({ categoryId, amount: 1000, frequency: "monthly", startDate: "2026-07-05" });
    const weekly = await createTemplate({ categoryId, amount: 300, frequency: "weekly", startDate: "2026-07-06" });
    setToday("2026-09-25");
    const firstRun = await generate();
    expect(firstRun).toBe(3 + 12); // Jul/Aug/Sep 5th + 12 Mondays Jul 6 – Sep 21

    await patchTemplate(monthly, { amount: 1200, startDate: "2026-07-05" });
    await patchTemplate(weekly, { amount: 350, startDate: "2026-07-06" });
    expect(await generate()).toBe(0);
  });

  it("concurrent generate calls (two open tabs) don't double-log", async () => {
    await createTemplate({ categoryId, amount: 65, frequency: "weekdays", startDate: "2026-07-01" });
    setToday("2026-07-10");
    const [a, b] = await Promise.all([generate(), generate()]);
    expect(a + b).toBe(weekdaysBetween("2026-07-01", "2026-07-10").length);
    const all = await expenseDates();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("recurring expenses — category ownership (B3)", () => {
  it("rejects PATCH to another user's category", async () => {
    const id = await createTemplate({ categoryId, amount: 65, frequency: "weekdays", startDate: "2026-07-01" });
    const foreign = await Category.create({ userId: otherUserId, name: "Secret", color: "#000000", sortOrder: 0 });

    const res = await patchTemplate(id, { categoryId: String(foreign._id) });
    expect(res.status).toBe(404);
  });

  it("rejects PATCH with a malformed categoryId", async () => {
    const id = await createTemplate({ categoryId, amount: 65, frequency: "weekdays", startDate: "2026-07-01" });
    const res = await patchTemplate(id, { categoryId: "not-an-id" });
    expect(res.status).toBe(400);
  });

  it("rejects PATCH to an archived category", async () => {
    const id = await createTemplate({ categoryId, amount: 65, frequency: "weekdays", startDate: "2026-07-01" });
    const archived = await Category.create({ userId, name: "Old", color: "#111111", sortOrder: 1, isArchived: true });
    const res = await patchTemplate(id, { categoryId: String(archived._id) });
    expect(res.status).toBe(404);
  });
});
