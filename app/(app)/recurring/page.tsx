import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import RecurringList from "@/components/RecurringList";

export default async function RecurringPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? "";
  const payload = await verifyJWT(token);
  if (!payload) redirect("/login");

  await connectDB();
  const user = await User.findById(payload.sub).select("currency").lean();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-lg mx-auto">
        <div className="py-4 mb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Recurring</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Auto-logged on schedule — rent, SIPs, subscriptions
          </p>
        </div>
        <RecurringList currency={user?.currency ?? "INR"} />
      </div>
    </main>
  );
}
