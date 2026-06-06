import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import Expense from "@/models/Expense";
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

  await connectDB();

  const pipeline: PipelineStage[] = [
    {
      $match: {
        userId: new Types.ObjectId(auth.userId),
        date: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: {
          month: { $month: "$date" },
          categoryId: "$categoryId",
        },
        total: { $sum: "$amount" },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id.categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
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

  // ── Build per-month structure ──────────────────────────────────────────────
  const monthMap = new Map<number, { categoryId: string; name: string; color: string; total: number }[]>();
  for (const row of rows) {
    const arr = monthMap.get(row.month) ?? [];
    arr.push({ categoryId: row.categoryId, name: row.name, color: row.color, total: row.total });
    monthMap.set(row.month, arr);
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const cats = monthMap.get(m) ?? [];
    return {
      month: m,
      label: MONTH_LABELS[i],
      total: cats.reduce((s, c) => s + c.total, 0),
      categories: cats,
    };
  });

  // ── Build per-category annual totals ──────────────────────────────────────
  const catMap = new Map<string, { name: string; color: string; total: number }>();
  for (const row of rows) {
    const existing = catMap.get(row.categoryId);
    if (existing) {
      existing.total += row.total;
    } else {
      catMap.set(row.categoryId, { name: row.name, color: row.color, total: row.total });
    }
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

  return NextResponse.json({ year, grandTotal, months, categories });
}
