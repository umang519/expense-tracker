export default function MonthLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between py-4 mb-3">
          <div className="h-4 w-14 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          <div className="h-5 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-14 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
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
