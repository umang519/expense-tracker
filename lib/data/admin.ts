import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Expense from "@/models/Expense";
import type { PipelineStage } from "mongoose";

const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNUP_CHART_DAYS = 14;
const ACTIVE_WINDOW_DAYS = 30;

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  activeUsersLast30Days: number;
  signupsByDay: { date: string; count: number }[];
}

// Admin-only view across ALL users — the one deliberate exception to CLAUDE.md
// rule 1 ("every query scoped by userId"), which is about isolating one
// user's data from another, not about an explicitly role-gated ops view.
// Callers (app/(app)/admin/page.tsx, app/api/admin/stats/route.ts) must both
// verify payload.role === "admin" from a verified JWT before calling this.
export async function getAdminStats(): Promise<AdminStats> {
  await connectDB();

  const now = new Date();
  const cutoff7 = new Date(now.getTime() - 7 * DAY_MS);
  const cutoff30 = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);
  const chartStart = new Date(now.getTime() - (SIGNUP_CHART_DAYS - 1) * DAY_MS);
  chartStart.setUTCHours(0, 0, 0, 0);

  const [
    totalUsers,
    verifiedUsers,
    newUsersLast7Days,
    newUsersLast30Days,
    activeUserIds,
    signupRows,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isEmailVerified: true }),
    User.countDocuments({ createdAt: { $gte: cutoff7 } }),
    User.countDocuments({ createdAt: { $gte: cutoff30 } }),
    Expense.distinct("userId", { createdAt: { $gte: cutoff30 } }),
    User.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: chartStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ] satisfies PipelineStage[]),
  ]);

  const countByDay = new Map(signupRows.map((r) => [r._id, r.count]));
  const signupsByDay = Array.from({ length: SIGNUP_CHART_DAYS }, (_, i) => {
    const d = new Date(chartStart.getTime() + i * DAY_MS);
    const date = d.toISOString().slice(0, 10);
    return { date, count: countByDay.get(date) ?? 0 };
  });

  return {
    totalUsers,
    verifiedUsers,
    newUsersLast7Days,
    newUsersLast30Days,
    activeUsersLast30Days: activeUserIds.length,
    signupsByDay,
  };
}
