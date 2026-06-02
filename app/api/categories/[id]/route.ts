import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { CategoryUpdateSchema } from "@/lib/validation";
import Category from "@/models/Category";
import Expense from "@/models/Expense";
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
  const parsed = CategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  await connectDB();

  const category = await Category.findOneAndUpdate(
    { _id: id, userId: auth.userId },
    { $set: parsed.data },
    { new: true }
  );

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({ category });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();

  const category = await Category.findOne({ _id: id, userId: auth.userId });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const hasExpenses = await Expense.exists({ categoryId: id, userId: auth.userId });

  if (hasExpenses) {
    // Archive instead of deleting to preserve expense history
    category.isArchived = true;
    await category.save();
    return NextResponse.json({ category, archived: true });
  }

  await category.deleteOne();
  return NextResponse.json({ deleted: true });
}
