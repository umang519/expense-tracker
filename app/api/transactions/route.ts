import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { TransactionCreateSchema } from "@/lib/validation";
import { summaryCacheTag } from "@/lib/data/summary";
import Transaction from "@/models/Transaction";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");

  await connectDB();

  const filter: Record<string, any> = { userId: auth.userId };

  if (year && /^\d{4}$/.test(year)) {
    const y = Number(year);
    filter.date = { $gte: new Date(Date.UTC(y, 0, 1)), $lt: new Date(Date.UTC(y + 1, 0, 1)) };
  }

  const transactions = await Transaction.find(filter).sort({ date: -1, _id: -1 });
  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = TransactionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { date, amount, type, description, isInvestment } = parsed.data;
  const [y, m, d] = date.split("-").map(Number);

  await connectDB();

  const transaction = await Transaction.create({
    userId: auth.userId,
    date: new Date(Date.UTC(y, m - 1, d)),
    amount,
    type,
    description,
    isInvestment: isInvestment ?? false,
  });

  revalidateTag(summaryCacheTag(auth.userId), "max");
  return NextResponse.json({ transaction }, { status: 201 });
}
