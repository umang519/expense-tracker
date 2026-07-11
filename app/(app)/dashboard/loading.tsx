export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between py-4 mb-3">
          <div className="space-y-2">
            <div className="h-6 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="h-8 w-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>

        <div className="space-y-3 mb-4">
          <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        </div>

        <div className="space-y-2 mt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  );
}
