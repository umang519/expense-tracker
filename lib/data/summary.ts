import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/db";
import Expense from "@/models/Expense";
import Transaction from "@/models/Transaction";
import Budget from "@/models/Budget";
import { Types, type PipelineStage } from "mongoose";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Both summary aggregations are read-heavy and recomputed from scratch on every
// request (per CLAUDE.md rule 5: never store computed totals). A short TTL cache,
// tagged per user, keeps that rule while avoiding a repeat Mongo round trip on
// rapid re-navigation. Mutation routes call revalidateSummaryCache(userId) so a
// newly added/edited/deleted expense or transaction is reflected immediately
// rather than waiting out the TTL.
export function summaryCacheTag(userId: string): string {
  return `summary-${userId}`;
}

export interface BudgetRef {
  _id: string;
  amount: number;
}

export interface CategorySummaryRow {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  percentage: number;
  budget: BudgetRef | null;
}

export interface MonthlySummary {
  total: number;
  overallBudget: BudgetRef | null;
  categories: CategorySummaryRow[];
}

// Shared by the /api/summary/monthly route and server components that need
// the same data at render time (dashboard, month page) to avoid a client-side
// fetch waterfall for above-the-fold content.
export async function getMonthlySummary(userId: string, month: string): Promise<MonthlySummary> {
  return unstable_cache(
    () => fetchMonthlySummary(userId, month),
    [`monthly-summary-${userId}-${month}`],
    { tags: [summaryCacheTag(userId)], revalidate: 60 }
  )();
}

async function fetchMonthlySummary(
  userId: string,
  month: string
): Promise<MonthlySummary> {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  const uid = new Types.ObjectId(userId);

  await connectDB();

  const pipeline: PipelineStage[] = [
    { $match: { userId: uid, date: { $gte: start, $lt: end } } },
    { $group: { _id: "$categoryId", total: { $sum: "$amount" } } },
    { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
    { $unwind: "$category" },
    {
      $project: {
        _id: 0,
        categoryId: { $toString: "$_id" },
        name: "$category.name",
        color: "$category.color",
        total: 1,
      },
    },
    { $sort: { total: -1 } },
  ];

  const rows = await Expense.aggregate(pipeline);
  const grandTotal = rows.reduce((s: number, r: { total: number }) => s + r.total, 0);

  const budgetDocs = await Budget.find({ userId: uid }).lean();

  const overallBudgetDoc = budgetDocs.find((b) => b.categoryId === null || b.categoryId == null);
  const overallBudget = overallBudgetDoc
    ? { _id: String(overallBudgetDoc._id), amount: overallBudgetDoc.amount }
    : null;

  const budgetByCategoryId = new Map<string, BudgetRef>();
  for (const b of budgetDocs) {
    if (b.categoryId) {
      budgetByCategoryId.set(String(b.categoryId), { _id: String(b._id), amount: b.amount });
    }
  }

  const categories: CategorySummaryRow[] = rows.map(
    (r: { categoryId: string; name: string; color: string; total: number }) => ({
      ...r,
      percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
      budget: budgetByCategoryId.get(r.categoryId) ?? null,
    })
  );

  return { total: grandTotal, overallBudget, categories };
}

export interface YearlyCategoryTotal {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  percentage: number;
  monthlyAvg: number;
}

export interface YearlyMonthRow {
  month: number;
  label: string;
  total: number;
  categories: { categoryId: string; name: string; color: string; total: number }[];
}

export interface YearlyTransactionMonthRow {
  month: number;
  label: string;
  received: number;
  spent: number;
  invested: number;
}

export interface YearlyBiggestExpense {
  amount: number;
  note: string | null;
  categoryName: string;
  categoryColor: string;
  date: string;
}

export interface YearlySummary {
  year: number;
  grandTotal: number;
  months: YearlyMonthRow[];
  categories: YearlyCategoryTotal[];
  transactions: {
    totalReceived: number;
    totalSpent: number;
    totalInvested: number;
    byMonth: YearlyTransactionMonthRow[];
  };
  biggestExpense: YearlyBiggestExpense | null;
}

// Shared by the /api/summary/yearly route; cached the same way as the monthly
// summary since it's the other read-heavy aggregation named in the perf plan.
export async function getYearlySummary(userId: string, year: number): Promise<YearlySummary> {
  return unstable_cache(
    () => fetchYearlySummary(userId, year),
    [`yearly-summary-${userId}-${year}`],
    { tags: [summaryCacheTag(userId)], revalidate: 60 }
  )();
}

async function fetchYearlySummary(userId: string, year: number): Promise<YearlySummary> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const uid = new Types.ObjectId(userId);

  await connectDB();

  const pipeline: PipelineStage[] = [
    { $match: { userId: uid, date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { month: { $month: "$date" }, categoryId: "$categoryId" },
        total: { $sum: "$amount" },
      },
    },
    { $lookup: { from: "categories", localField: "_id.categoryId", foreignField: "_id", as: "category" } },
    { $unwind: "$category" },
    {
      $project: {
        _id: 0,
        month: "$_id.month",
        categoryId: { $toString: "$_id.categoryId" },
        name: "$category.name",
        color: "$category.color",
        total: 1,
      },
    },
    { $sort: { month: 1, total: -1 } },
  ];

  const rows = await Expense.aggregate(pipeline);

  const monthMap = new Map<number, { categoryId: string; name: string; color: string; total: number }[]>();
  for (const row of rows) {
    const arr = monthMap.get(row.month) ?? [];
    arr.push({ categoryId: row.categoryId, name: row.name, color: row.color, total: row.total });
    monthMap.set(row.month, arr);
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const cats = monthMap.get(m) ?? [];
    return { month: m, label: MONTH_LABELS[i], total: cats.reduce((s, c) => s + c.total, 0), categories: cats };
  });

  const catMap = new Map<string, { name: string; color: string; total: number }>();
  for (const row of rows) {
    const existing = catMap.get(row.categoryId);
    if (existing) existing.total += row.total;
    else catMap.set(row.categoryId, { name: row.name, color: row.color, total: row.total });
  }

  const grandTotal = Array.from(catMap.values()).reduce((s, c) => s + c.total, 0);
  const activeMonths = months.filter((m) => m.total > 0).length;

  const categories = Array.from(catMap.entries())
    .map(([categoryId, { name, color, total }]) => ({
      categoryId,
      name,
      color,
      total,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
      monthlyAvg: activeMonths > 0 ? Math.round(total / activeMonths) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const txAgg = await Transaction.aggregate([
    { $match: { userId: uid, date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: {
          month: { $month: "$date" },
          type: "$type",
          isInvestment: { $ifNull: ["$isInvestment", false] },
        },
        total: { $sum: "$amount" },
      },
    },
  ]);

  let txTotalReceived = 0;
  let txTotalSpent = 0;
  let txTotalInvested = 0;
  const txMonthMap = new Map<number, { received: number; spent: number; invested: number }>();

  for (const row of txAgg) {
    const { month, type, isInvestment } = row._id;
    const m = txMonthMap.get(month) ?? { received: 0, spent: 0, invested: 0 };
    if (type === "Cr") {
      txTotalReceived += row.total;
      m.received += row.total;
    } else if (isInvestment) {
      txTotalInvested += row.total;
      m.invested += row.total;
    } else {
      txTotalSpent += row.total;
      m.spent += row.total;
    }
    txMonthMap.set(month, m);
  }

  const txByMonth = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return { month: m, label: MONTH_LABELS[i], ...(txMonthMap.get(m) ?? { received: 0, spent: 0, invested: 0 }) };
  });

  const [biggestExpenseDoc = null] = await Expense.aggregate([
    { $match: { userId: uid, date: { $gte: start, $lt: end } } },
    { $sort: { amount: -1 } },
    { $limit: 1 },
    { $lookup: { from: "categories", localField: "categoryId", foreignField: "_id", as: "cat" } },
    { $unwind: "$cat" },
    {
      $project: {
        _id: 0,
        amount: 1,
        note: 1,
        date: 1,
        categoryName: "$cat.name",
        categoryColor: "$cat.color",
      },
    },
  ]);

  const biggestExpense = biggestExpenseDoc
    ? {
        amount: biggestExpenseDoc.amount,
        note: biggestExpenseDoc.note ?? null,
        categoryName: biggestExpenseDoc.categoryName,
        categoryColor: biggestExpenseDoc.categoryColor,
        date: (biggestExpenseDoc.date as Date).toISOString().slice(0, 10),
      }
    : null;

  return {
    year,
    grandTotal,
    months,
    categories,
    transactions: {
      totalReceived: txTotalReceived,
      totalSpent: txTotalSpent,
      totalInvested: txTotalInvested,
      byMonth: txByMonth,
    },
    biggestExpense,
  };
}
