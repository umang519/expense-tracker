import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import { getAdminStats } from "@/lib/data/admin";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? "";
  const payload = await verifyJWT(token);
  // Defense in depth — proxy.ts already redirects non-admins away from
  // /admin, but this page doesn't rely on that alone.
  if (!payload || payload.role !== "admin") redirect("/dashboard");

  const stats = await getAdminStats();
  const maxSignupCount = Math.max(1, ...stats.signupsByDay.map((d) => d.count));

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-lg mx-auto">
        <div className="py-4 mb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Signups &amp; activity</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatTile label="Total users" value={stats.totalUsers} />
          <StatTile label="Verified" value={stats.verifiedUsers} />
          <StatTile label="New (7d)" value={stats.newUsersLast7Days} />
          <StatTile label="New (30d)" value={stats.newUsersLast30Days} />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-4">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
            Active users
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats.activeUsersLast30Days}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Logged at least one expense in the last 30 days
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
            Signups — last 14 days
          </p>
          <div className="space-y-1.5">
            {stats.signupsByDay.map((d) => (
              <div key={d.date} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 w-10 shrink-0 font-mono">
                  {d.date.slice(5)}
                </span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${(d.count / maxSignupCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 w-5 text-right">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
