import { NextRequest, NextResponse } from "next/server";
import { sendDailyReminderIfDue } from "@/lib/push";

// Vercel cron jobs make GET requests — handler must be GET
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDailyReminderIfDue();
  return NextResponse.json(result);
}
