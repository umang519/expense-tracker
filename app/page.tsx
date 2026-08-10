import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyJWT } from "@/lib/auth";

const FEATURES = [
  {
    title: "Log an expense in seconds",
    body: "A numeric keypad, recent categories, and a repeat-last-expense shortcut — built so tracking never feels like a chore.",
  },
  {
    title: "Budgets & reports",
    body: "Per-category budgets with progress bars, plus monthly and yearly reports with trends, category breakdowns, and CSV export.",
  },
  {
    title: "Recurring expenses",
    body: "Rent, subscriptions, EMIs, and SIPs auto-logged on a schedule you set once.",
  },
  {
    title: "Works offline, installs like an app",
    body: "A full PWA — install to your home screen, log expenses with no signal, and they sync once you're back online.",
  },
];

export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token && (await verifyJWT(token))) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-md mx-auto px-5 py-10 sm:py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 text-white text-2xl font-bold mb-5">
            O
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Outlay</h1>
          <p className="text-base text-gray-500 dark:text-gray-400 mt-2">
            Log an expense in under 5 seconds. See exactly where your money goes. Free, private,
            and open source.
          </p>
        </div>

        <div className="flex gap-3 mt-8">
          <Link
            href="/register"
            className="flex-1 text-center bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 rounded-xl transition-colors text-sm"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="flex-1 text-center border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium py-3 rounded-xl transition-colors text-sm"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-10 space-y-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5"
            >
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{f.title}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-400 dark:text-gray-500">
          <Link href="/privacy" className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline">
            Terms of Service
          </Link>
          <a
            href="https://github.com/umang519/expense-tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
          >
            Source on GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
