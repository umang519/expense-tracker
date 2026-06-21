import QueryProvider from "@/components/QueryProvider";
import BottomNav from "@/components/BottomNav";
import AddExpenseButton from "@/components/AddExpenseButton";
import RecurringAutoGenerate from "@/components/RecurringAutoGenerate";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import OfflineIndicator from "@/components/OfflineIndicator";
import OfflineSyncProvider from "@/components/OfflineSyncProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ServiceWorkerRegister />
      <RecurringAutoGenerate />
      <OfflineIndicator />
      <OfflineSyncProvider />
      <div className="pb-16">{children}</div>
      <AddExpenseButton />
      <BottomNav />
    </QueryProvider>
  );
}
