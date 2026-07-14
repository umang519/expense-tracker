import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { TransactionUpdateSchema } from "@/lib/validation";
import { summaryCacheTag } from "@/lib/data/summary";
import Transaction from "@/models/Transaction";
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
  const parsed = TransactionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const update: Record<string, any> = {};
  if (parsed.data.date) {
    const [y, m, d] = parsed.data.date.split("-").map(Number);
    update.date = new Date(Date.UTC(y, m - 1, d));
  }
  if (parsed.data.amount !== undefined) update.amount = parsed.data.amount;
  if (parsed.data.type !== undefined) update.type = parsed.data.type;
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.isInvestment !== undefined) update.isInvestment = parsed.data.isInvestment;

  await connectDB();

  const transaction = await Transaction.findOneAndUpdate(
    { _id: id, userId: auth.userId },
    { $set: update },
    { new: true }
  );

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  revalidateTag(summaryCacheTag(auth.userId), "max");
  return NextResponse.json({ transaction });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();

  const transaction = await Transaction.findOneAndDelete({ _id: id, userId: auth.userId });
  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  revalidateTag(summaryCacheTag(auth.userId), "max");
  return NextResponse.json({ deleted: true });
}
