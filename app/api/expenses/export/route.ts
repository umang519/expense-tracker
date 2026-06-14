import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import Expense from "@/models/Expense";
import { Types } from "mongoose";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const yearParam = searchParams.get("year");
  const categoryId = searchParams.get("categoryId");
  const note = searchParams.get("note");
  const amountMin = searchParams.get("amountMin");
  const amountMax = searchParams.get("amountMax");

  await connectDB();

  const filter: Record<string, unknown> = { userId: new Types.ObjectId(auth.userId) };

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, mon] = month.split("-").map(Number);
    filter.date = {
      $gte: new Date(Date.UTC(y, mon - 1, 1)),
      $lt: new Date(Date.UTC(y, mon, 1)),
    };
  } else if (yearParam && /^\d{4}$/.test(yearParam)) {
    const y = Number(yearParam);
    filter.date = {
      $gte: new Date(Date.UTC(y, 0, 1)),
      $lt: new Date(Date.UTC(y + 1, 0, 1)),
    };
  }

  if (categoryId && Types.ObjectId.isValid(categoryId)) {
    filter.categoryId = new Types.ObjectId(categoryId);
  }

  if (note) {
    filter.note = { $regex: note.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  if (amountMin || amountMax) {
    const amtFilter: Record<string, number> = {};
    if (amountMin) amtFilter.$gte = parseFloat(amountMin);
    if (amountMax) amtFilter.$lte = parseFloat(amountMax);
    filter.amount = amtFilter;
  }

  const expenses = await Expense.find(filter)
    .populate("categoryId", "name")
    .sort({ date: 1, _id: 1 })
    .lean();

  const csvEscape = (v: string | number) =>
    `"${String(v).replace(/"/g, '""')}"`;

  const rows: string[] = [
    ["Date", "Category", "Amount", "Note"].map(csvEscape).join(","),
    ...expenses.map((e) => {
      const date = new Date(e.date).toISOString().substring(0, 10);
      const category = (e.categoryId as unknown as { name: string } | null)?.name ?? "";
      return [date, category, e.amount, e.note ?? ""].map(csvEscape).join(",");
    }),
  ];

  const csv = rows.join("\r\n");
  const filename = month
    ? `expenses-${month}.csv`
    : yearParam
    ? `expenses-${yearParam}.csv`
    : "expenses.csv";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
