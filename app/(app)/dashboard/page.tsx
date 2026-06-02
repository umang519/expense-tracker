import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import MonthSummary from "@/components/MonthSummary";
import ExpenseList from "@/components/ExpenseList";
import { currentMonth, monthLabel } from "@/lib/format";

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

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between py-4 mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {user.name ? `Hi, ${user.name}` : "Dashboard"}
            </h1>
            <Link
              href={`/month/${month}`}
              className="text-sm text-violet-500 hover:underline"
            >
              {monthLabel(month)} →
            </Link>
          </div>
          <LogoutButton />
        </div>

        {/* Monthly summary: total + donut + category bars */}
        <MonthSummary month={month} currency={currency} />

        {/* Expense list grouped by day */}
        <ExpenseList month={month} currency={currency} />
      </div>
    </main>
  );
}
