import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { ExpenseUpdateSchema } from "@/lib/validation";
import Expense from "@/models/Expense";
import Category from "@/models/Category";
import { Types } from "mongoose";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = ExpenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  await connectDB();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};

  if (parsed.data.date) {
    const [y, m, d] = parsed.data.date.split("-").map(Number);
    update.date = new Date(Date.UTC(y, m - 1, d));
  }
  if (parsed.data.categoryId !== undefined) {
    if (!Types.ObjectId.isValid(parsed.data.categoryId)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const cat = await Category.findOne({
      _id: parsed.data.categoryId,
      userId: auth.userId,
    });
    if (!cat) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    update.categoryId = parsed.data.categoryId;
  }
  if (parsed.data.amount !== undefined) update.amount = parsed.data.amount;
  if (parsed.data.note !== undefined) update.note = parsed.data.note;

  const expense = await Expense.findOneAndUpdate(
    { _id: id, userId: auth.userId },
    { $set: update },
    { new: true }
  ).populate("categoryId", "name color");

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  return NextResponse.json({ expense });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();

  const expense = await Expense.findOneAndDelete({ _id: id, userId: auth.userId });
  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
