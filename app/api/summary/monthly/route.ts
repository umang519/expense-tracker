import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import Expense from "@/models/Expense";
import { Types, type PipelineStage } from "mongoose";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 1);

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
        _id: "$categoryId",
        total: { $sum: "$amount" },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
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

  const categories = rows.map((r: { categoryId: string; name: string; color: string; total: number }) => ({
    ...r,
    percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
  }));

  return NextResponse.json({ total: grandTotal, categories });
}
