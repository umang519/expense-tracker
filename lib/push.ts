import webpush from "web-push";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import NotificationRun from "@/models/NotificationRun";

const PAYLOAD = JSON.stringify({
  title: "Outlay",
  body: "Don't forget to log today's expenses! 📝",
});

const REMINDER_KEY = "daily-reminder";
const REMINDER_HOUR_IST = 19;
const REMINDER_MINUTE_IST = 30;

// Vercel Hobby cron jobs run in a "flexible 1-hour window" and are not
// guaranteed to fire at all — this offset lets us compute IST wall-clock
// time from the server's UTC clock without a timezone library.
function nowIST(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

function todayIST(): string {
  return nowIST().toISOString().slice(0, 10);
}

export function isPastReminderTimeIST(): boolean {
  const ist = nowIST();
  const minutesSinceMidnight = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutesSinceMidnight >= REMINDER_HOUR_IST * 60 + REMINDER_MINUTE_IST;
}

export interface SendResult {
  sent: number;
  removed: number;
  skipped: boolean;
}

// Sends the daily reminder to every subscribed device, but at most once per
// IST calendar day — safe to call from the cron AND from a client-triggered
// fallback (see /api/push/notify-check) without risking a duplicate broadcast.
export async function sendDailyReminderIfDue(): Promise<SendResult> {
  await connectDB();

  const today = todayIST();
  const previous = await NotificationRun.findOneAndUpdate(
    { key: REMINDER_KEY },
    { $set: { lastSentDate: today } },
    { upsert: true, new: false }
  );
  if (previous?.lastSentDate === today) {
    return { sent: 0, removed: 0, skipped: true };
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const subs = await PushSubscription.find({}).lean();
  let sent = 0;
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          PAYLOAD
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          stale.push(sub.endpoint);
        } else {
          console.error("[push] send failed for", sub.endpoint, err);
        }
      }
    })
  );

  if (stale.length > 0) {
    await PushSubscription.deleteMany({ endpoint: { $in: stale } });
  }

  return { sent, removed: stale.length, skipped: false };
}
