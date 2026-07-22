import { NextResponse } from "next/server";
import { sendDailyReminderIfDue, isPastReminderTimeIST } from "@/lib/push";

// Fallback for Vercel's Hobby-plan cron, which runs in a "flexible 1-hour
// window" and isn't guaranteed to fire every day. Deliberately unauthenticated:
// it's triggered from the root layout on *any* page view (including /login),
// so it still fires even when nobody currently has a valid session — that's
// exactly the scenario it needs to cover for. It's safe to leave open because
// it doesn't read/write any user-specific data and sendDailyReminderIfDue is
// idempotent per IST calendar day, so it can't be abused to spam anyone.
export async function POST() {
  if (!isPastReminderTimeIST()) {
    return NextResponse.json({ skipped: true });
  }

  const result = await sendDailyReminderIfDue();
  return NextResponse.json(result);
}
