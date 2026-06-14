import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import RecurringExpense from "@/models/RecurringExpense";
import Expense from "@/models/Expense";
import { Types } from "mongoose";

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

function clampDay(year: number, month: number, day: number): Date {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth)));
}

function isWeekday(d: Date): boolean {
  const dow = d.getUTCDay(); // 0=Sun, 6=Sat
  return dow >= 1 && dow <= 5;
}

function getDueDates(
  frequency: "monthly" | "weekly" | "weekdays",
  startDate: Date,
  endDate: Date | null,
  lastGeneratedDate: Date | null,
  today: Date
): Date[] {
  // Cap generation at endDate if set
  const ceiling = endDate && endDate < today ? endDate : today;
  const dates: Date[] = [];

  if (frequency === "weekdays") {
    // Every Mon-Fri, one entry per day
    let d = new Date(startDate);
    if (lastGeneratedDate) {
      d = addDays(lastGeneratedDate, 1);
    }
    while (d <= ceiling) {
      if (isWeekday(d)) dates.push(new Date(d));
      d = addDays(d, 1);
    }
  } else if (frequency === "weekly") {
    // Every 7 days from startDate
    let d = new Date(startDate);
    if (lastGeneratedDate) {
      while (d <= lastGeneratedDate) d = addDays(d, 7);
    }
    while (d <= ceiling) {
      dates.push(new Date(d));
      d = addDays(d, 7);
    }
  } else {
    // monthly — same calendar day each month
    const day = startDate.getUTCDate();
    let d: Date;

    if (!lastGeneratedDate) {
      d = new Date(startDate);
    } else {
      let y = lastGeneratedDate.getUTCFullYear();
      let m = lastGeneratedDate.getUTCMonth() + 1;
      if (m > 11) { m = 0; y++; }
      d = clampDay(y, m, day);
    }

    while (d <= ceiling) {
      if (d >= startDate) dates.push(new Date(d));
      let y = d.getUTCFullYear();
      let m = d.getUTCMonth() + 1;
      if (m > 11) { m = 0; y++; }
      d = clampDay(y, m, day);
    }
  }

  return dates;
}

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
    // Skip entirely if endDate is in the past and already fully generated
    if (tmpl.endDate && tmpl.lastGeneratedDate && tmpl.lastGeneratedDate >= tmpl.endDate) continue;

    const dueDates = getDueDates(
      tmpl.frequency,
      tmpl.startDate,
      tmpl.endDate ?? null,
      tmpl.lastGeneratedDate,
      todayUTC
    );

    if (dueDates.length === 0) continue;

    const expenseDocs = dueDates.map((date) => ({
      userId: uid,
      date,
      categoryId: tmpl.categoryId,
      amount: tmpl.amount,
      note: tmpl.note,
    }));

    await Expense.insertMany(expenseDocs, { ordered: false });

    await RecurringExpense.updateOne(
      { _id: tmpl._id },
      { $set: { lastGeneratedDate: dueDates[dueDates.length - 1] } }
    );

    totalGenerated += dueDates.length;
  }

  return NextResponse.json({ generated: totalGenerated });
}
