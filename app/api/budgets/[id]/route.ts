import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { BudgetUpdateSchema } from "@/lib/validation";
import Budget from "@/models/Budget";
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
  const parsed = BudgetUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  await connectDB();

  const budget = await Budget.findOneAndUpdate(
    { _id: id, userId: auth.userId },
    { $set: { amount: parsed.data.amount } },
    { new: true }
  );

  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ budget });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();

  const budget = await Budget.findOneAndDelete({ _id: id, userId: auth.userId });
  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
