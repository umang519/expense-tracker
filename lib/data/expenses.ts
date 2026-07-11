import { connectDB } from "@/lib/db";
import Expense from "@/models/Expense";
import Category from "@/models/Category";
import type { PopulatedExpense, Category as CategoryDTO } from "@/lib/types";
import type { Types } from "mongoose";

// Shared by the /api/expenses and /api/categories routes and server components
// that need the same data at render time (dashboard, month page) to avoid a
// client-side fetch waterfall for above-the-fold content.
export async function getExpensesForMonth(
  userId: string,
  month: string
): Promise<PopulatedExpense[]> {
  await connectDB();

  const [year, mon] = month.split("-").map(Number);
  const filter = {
    userId,
    date: {
      $gte: new Date(Date.UTC(year, mon - 1, 1)),
      $lt: new Date(Date.UTC(year, mon, 1)),
    },
  };

  const expenses = await Expense.find(filter)
    .populate<{ categoryId: { _id: Types.ObjectId; name: string; color: string } }>(
      "categoryId",
      "name color"
    )
    .sort({ date: -1, _id: -1 })
    .lean();

  return expenses.map((e) => ({
    _id: String(e._id),
    date: e.date.toISOString(),
    amount: e.amount,
    note: e.note,
    categoryId: {
      _id: String(e.categoryId._id),
      name: e.categoryId.name,
      color: e.categoryId.color,
    },
  }));
}

export async function getCategoriesForUser(userId: string): Promise<CategoryDTO[]> {
  await connectDB();

  const categories = await Category.find({ userId }).sort({ sortOrder: 1, _id: 1 }).lean();

  return categories.map((c) => ({
    _id: String(c._id),
    name: c.name,
    color: c.color,
    sortOrder: c.sortOrder,
    isArchived: c.isArchived,
  }));
}
