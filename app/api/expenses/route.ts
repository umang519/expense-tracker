import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { ExpenseCreateSchema } from "@/lib/validation";
import Expense from "@/models/Expense";
import Category from "@/models/Category";
import { Types } from "mongoose";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM

  await connectDB();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { userId: auth.userId };

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split("-").map(Number);
    filter.date = {
      $gte: new Date(Date.UTC(year, mon - 1, 1)),
      $lt: new Date(Date.UTC(year, mon, 1)),
    };
  }

  const expenses = await Expense.find(filter)
    .populate("categoryId", "name color")
    .sort({ date: -1, _id: -1 });

  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = ExpenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { date, categoryId, amount, note } = parsed.data;

  if (!Types.ObjectId.isValid(categoryId)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  await connectDB();

  // Verify the category belongs to this user
  const category = await Category.findOne({
    _id: categoryId,
    userId: auth.userId,
    isArchived: false,
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const [y, m, d] = date.split("-").map(Number);
  const expense = await Expense.create({
    userId: auth.userId,
    date: new Date(Date.UTC(y, m - 1, d)),
    categoryId,
    amount,
    note,
  });

  const populated = await expense.populate("categoryId", "name color");
  return NextResponse.json({ expense: populated }, { status: 201 });
}
