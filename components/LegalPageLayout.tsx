import Link from "next/link";

export default function LegalPageLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12">
        <Link
          href="/"
          className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
        >
          ← Back to Outlay
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4">
          {title}
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Last updated {updated}
        </p>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:dark:text-gray-100 [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-violet-600 [&_a]:dark:text-violet-400 [&_a]:hover:underline">
          {children}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-400 dark:text-gray-500">
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
          <a
            href="https://github.com/umang519/expense-tracker/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
          >
            Support
          </a>
        </div>
      </div>
    </div>
  );
}
