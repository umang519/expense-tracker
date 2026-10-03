import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { RecurringExpenseUpdateSchema } from "@/lib/validation";
import { parseYmd } from "@/lib/recurring";
import RecurringExpense from "@/models/RecurringExpense";
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
  const parsed = RecurringExpenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  await connectDB();

  // Same ownership check as POST — never let a template point at another
  // user's (or an archived) category (CLAUDE.md rule 1).
  if (parsed.data.categoryId !== undefined) {
    if (!Types.ObjectId.isValid(parsed.data.categoryId)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const category = await Category.findOne({
      _id: parsed.data.categoryId,
      userId: auth.userId,
      isArchived: false,
    });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { ...parsed.data };

  // Edits apply to upcoming entries only. lastGeneratedDate is deliberately
  // left untouched: resetting it here (as this route used to) made the next
  // generate run re-log every date since startDate — e.g. changing just the
  // amount of a months-old weekday template duplicated months of expenses,
  // because the edit form always re-sends the unchanged startDate.
  if (parsed.data.startDate) {
    update.startDate = parseYmd(parsed.data.startDate);
  }

  if ("endDate" in parsed.data) {
    if (parsed.data.endDate) {
      update.endDate = parseYmd(parsed.data.endDate);
    } else {
      update.endDate = null;
    }
  }

  const entry = await RecurringExpense.findOneAndUpdate(
    { _id: id, userId: auth.userId },
    { $set: update },
    { new: true }
  ).populate("categoryId", "name color");

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ recurring: entry });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();

  const entry = await RecurringExpense.findOneAndDelete({ _id: id, userId: auth.userId });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
