import { connectDB } from "@/lib/db";
import Expense from "@/models/Expense";
import Budget from "@/models/Budget";
import { Types, type PipelineStage } from "mongoose";

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
export async function getMonthlySummary(
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
