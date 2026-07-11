export default function ReportsLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-lg mx-auto">
        <div className="py-4 mb-3 space-y-2">
          <div className="h-6 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-40 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="h-56 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse mb-3" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  );
}
