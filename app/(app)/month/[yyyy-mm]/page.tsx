import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Link from "next/link";
import MonthSummary from "@/components/MonthSummary";
import ExpenseList from "@/components/ExpenseList";
import { monthLabel, adjacentMonths, currentMonth } from "@/lib/format";

type Props = { params: Promise<{ "yyyy-mm": string }> };

export default async function MonthPage({ params }: Props) {
  const { "yyyy-mm": month } = await params;

  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? "";
  const payload = await verifyJWT(token);
  if (!payload) redirect("/login");

  await connectDB();
  const user = await User.findById(payload.sub).select("-passwordHash").lean();
  if (!user) redirect("/login");

  const currency = user.currency ?? "INR";
  const { prev, next } = adjacentMonths(month);
  const now = currentMonth();
  const isFuture = month > now;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-lg mx-auto">
        {/* Month navigation header */}
        <div className="flex items-center justify-between py-4 mb-3">
          <Link
            href={`/month/${prev}`}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-500/10"
          >
            ← Prev
          </Link>

          <div className="text-center">
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">{monthLabel(month)}</h1>
            {month === now && (
              <span className="text-xs text-violet-500 dark:text-violet-400 font-medium">This month</span>
            )}
          </div>

          <Link
            href={isFuture ? "#" : `/month/${next}`}
            aria-disabled={isFuture}
            className={`flex items-center gap-1 text-sm transition-colors px-2 py-1 rounded-lg ${
              isFuture
                ? "text-gray-300 dark:text-gray-600 cursor-default"
                : "text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10"
            }`}
          >
            Next →
          </Link>
        </div>

        {/* Monthly summary */}
        <MonthSummary month={month} currency={currency} />

        {/* All expenses grouped by day */}
        <ExpenseList month={month} currency={currency} />
      </div>
    </main>
  );
}
