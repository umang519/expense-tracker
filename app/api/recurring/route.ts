import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { RecurringExpenseCreateSchema } from "@/lib/validation";
import RecurringExpense from "@/models/RecurringExpense";
import Category from "@/models/Category";
import { Types } from "mongoose";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const recurring = await RecurringExpense.find({ userId: auth.userId })
    .populate("categoryId", "name color")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ recurring });
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = RecurringExpenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { categoryId, amount, note, frequency, startDate, endDate } = parsed.data;

  if (!Types.ObjectId.isValid(categoryId)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  if (endDate && endDate <= startDate) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  await connectDB();

  const category = await Category.findOne({ _id: categoryId, userId: auth.userId, isArchived: false });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const [y, m, d] = startDate.split("-").map(Number);
  const parsedEnd = endDate ? (() => { const [ey, em, ed] = endDate.split("-").map(Number); return new Date(Date.UTC(ey, em - 1, ed)); })() : null;

  const entry = await RecurringExpense.create({
    userId: auth.userId,
    categoryId,
    amount,
    note,
    frequency,
    startDate: new Date(Date.UTC(y, m - 1, d)),
    endDate: parsedEnd,
    lastGeneratedDate: null,
    isActive: true,
  });

  const populated = await entry.populate("categoryId", "name color");
  return NextResponse.json({ recurring: populated }, { status: 201 });
}
