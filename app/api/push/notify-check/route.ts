import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { sendDailyReminderIfDue, isPastReminderTimeIST } from "@/lib/push";

// Fallback for Vercel's Hobby-plan cron, which runs in a "flexible 1-hour
// window" and isn't guaranteed to fire every day. Any logged-in user opening
// the app after the scheduled reminder time triggers this; sendDailyReminderIfDue
// is idempotent per IST calendar day, so it's safe even if the real cron also fires.
export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPastReminderTimeIST()) {
    return NextResponse.json({ skipped: true });
  }

  const result = await sendDailyReminderIfDue();
  return NextResponse.json(result);
}
