import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import QueryProvider from "@/components/QueryProvider";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import BottomNav from "@/components/BottomNav";
import AddExpenseButton from "@/components/AddExpenseButton";
import RecurringAutoGenerate from "@/components/RecurringAutoGenerate";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import OfflineIndicator from "@/components/OfflineIndicator";
import OfflineSyncProvider from "@/components/OfflineSyncProvider";

// Client pages (categories, transactions) and the global add-expense sheet
// can't read the user server-side themselves, so the display currency is
// resolved here once and shared via context. Pages handle the auth redirect.
async function getCurrency(): Promise<string> {
  const token = (await cookies()).get("token")?.value ?? "";
  const payload = await verifyJWT(token);
  if (!payload) return "INR";
  await connectDB();
  const user = await User.findById(payload.sub).select("currency").lean();
  return user?.currency ?? "INR";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const currency = await getCurrency();

  return (
    <QueryProvider>
      <CurrencyProvider currency={currency}>
        <ServiceWorkerRegister />
        <RecurringAutoGenerate />
        <OfflineIndicator />
        <OfflineSyncProvider />
        <div className="pb-16">{children}</div>
        <AddExpenseButton />
        <BottomNav />
      </CurrencyProvider>
    </QueryProvider>
  );
}
