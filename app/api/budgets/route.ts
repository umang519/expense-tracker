import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { BudgetUpsertSchema } from "@/lib/validation";
import { summaryCacheTag } from "@/lib/data/summary";
import Budget from "@/models/Budget";
import { Types } from "mongoose";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const budgets = await Budget.find({ userId: auth.userId }).lean();
  return NextResponse.json({ budgets });
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = BudgetUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { categoryId, amount } = parsed.data;

  await connectDB();

  // Upsert: one budget per user+category
  const budget = await Budget.findOneAndUpdate(
    {
      userId: new Types.ObjectId(auth.userId),
      categoryId: categoryId ? new Types.ObjectId(categoryId) : null,
    },
    { $set: { amount } },
    { upsert: true, new: true }
  );

  revalidateTag(summaryCacheTag(auth.userId), "max");
  return NextResponse.json({ budget }, { status: 200 });
}
