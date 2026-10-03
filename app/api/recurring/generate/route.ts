import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { revalidateSummaryCache } from "@/lib/data/summary";
import { getDueDates } from "@/lib/recurring";
import RecurringExpense from "@/models/RecurringExpense";
import Expense from "@/models/Expense";
import { Types } from "mongoose";

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const uid = new Types.ObjectId(auth.userId);
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const templates = await RecurringExpense.find({ userId: uid, isActive: true }).lean();

  let totalGenerated = 0;

  for (const tmpl of templates) {
    const dueDates = getDueDates(
      tmpl.frequency,
      tmpl.startDate,
      tmpl.endDate ?? null,
      tmpl.lastGeneratedDate,
      todayUTC
    );

    if (dueDates.length === 0) continue;

    // Claim these dates before inserting: the conditional update only matches
    // if lastGeneratedDate is still what we read, so a concurrent request (two
    // tabs, or a re-mount) that already claimed them makes this a no-op
    // instead of logging every date twice.
    const claimed = await RecurringExpense.updateOne(
      { _id: tmpl._id, lastGeneratedDate: tmpl.lastGeneratedDate },
      { $set: { lastGeneratedDate: dueDates[dueDates.length - 1] } }
    );
    if (claimed.modifiedCount === 0) continue;

    try {
      await Expense.insertMany(
        dueDates.map((date) => ({
          userId: uid,
          date,
          categoryId: tmpl.categoryId,
          amount: tmpl.amount,
          note: tmpl.note,
        })),
        { ordered: false }
      );
    } catch (err) {
      // Release the claim so the next app open retries these dates.
      await RecurringExpense.updateOne(
        { _id: tmpl._id, lastGeneratedDate: dueDates[dueDates.length - 1] },
        { $set: { lastGeneratedDate: tmpl.lastGeneratedDate } }
      );
      throw err;
    }

    totalGenerated += dueDates.length;
  }

  if (totalGenerated > 0) revalidateSummaryCache(auth.userId);
  return NextResponse.json({ generated: totalGenerated });
}
