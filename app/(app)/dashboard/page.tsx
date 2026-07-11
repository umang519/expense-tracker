import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import MonthSummary from "@/components/MonthSummary";
import ExpenseList from "@/components/ExpenseList";
import RecurringLoggedBanner from "@/components/RecurringLoggedBanner";
import { currentMonth, monthLabel } from "@/lib/format";
import { getMonthlySummary } from "@/lib/data/summary";
import { getExpensesForMonth, getCategoriesForUser } from "@/lib/data/expenses";

export const preferredRegion = "bom1";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? "";
  const payload = await verifyJWT(token);
  if (!payload) redirect("/login");

  await connectDB();
  const user = await User.findById(payload.sub).select("-passwordHash").lean();
  if (!user) redirect("/login");

  const month = currentMonth();
  const currency = user.currency ?? "INR";

  // Fetch above-the-fold data on the server (in parallel) so the LCP content
  // ships with the initial HTML instead of waiting on a client-side fetch
  // after hydration.
  const [summary, expenses, categories] = await Promise.all([
    getMonthlySummary(payload.sub, month),
    getExpensesForMonth(payload.sub, month),
    getCategoriesForUser(payload.sub),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between py-4 mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {user.name ? `Hi, ${user.name}` : "Dashboard"}
            </h1>
            <Link
              href={`/month/${month}`}
              className="text-sm text-violet-500 dark:text-violet-400 hover:underline"
            >
              {monthLabel(month)} →
            </Link>
          </div>
          <LogoutButton />
        </div>

        {/* Auto-log notice — appears when recurring entries were generated on this open */}
        <RecurringLoggedBanner />

        {/* Monthly summary: total + donut + category bars */}
        <MonthSummary month={month} currency={currency} initialData={summary} />

        {/* Expense list grouped by day */}
        <ExpenseList
          month={month}
          currency={currency}
          initialExpenses={expenses}
          initialCategories={categories}
        />
      </div>
    </main>
  );
}
