import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import Expense from "@/models/Expense";
import Transaction from "@/models/Transaction";
import { Types, type PipelineStage } from "mongoose";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");

  if (!yearParam || !/^\d{4}$/.test(yearParam)) {
    return NextResponse.json({ error: "year param required (YYYY)" }, { status: 400 });
  }

  const year = Number(yearParam);
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const uid = new Types.ObjectId(auth.userId);

  await connectDB();

  // ── Expense aggregation (unchanged) ───────────────────────────────────────
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

  // ── Transaction aggregation ────────────────────────────────────────────────
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

  // ── Biggest single expense ─────────────────────────────────────────────────
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

  return NextResponse.json({
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
  });
}
