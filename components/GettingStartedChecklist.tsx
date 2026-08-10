"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

const STORAGE_KEY = "gettingStartedDismissed";
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

// Server can't know localStorage — assume not-dismissed there. It's discarded
// on hydration in favor of the real client snapshot, same as ThemeToggle.
function getServerSnapshot(): boolean {
  return false;
}

function dismiss() {
  localStorage.setItem(STORAGE_KEY, "1");
  listeners.forEach((cb) => cb());
}

export default function GettingStartedChecklist() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (dismissed) return null;

  return (
    <div className="mb-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Getting started</h2>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 text-lg leading-none"
        >
          ×
        </button>
      </div>
      <div className="space-y-2">
        <Link
          href="/categories"
          className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm text-gray-700 dark:text-gray-300">Set a monthly budget</span>
          <span className="text-gray-300 dark:text-gray-600 text-lg">›</span>
        </Link>
        <Link
          href="/settings"
          className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm text-gray-700 dark:text-gray-300">Turn on daily reminders</span>
          <span className="text-gray-300 dark:text-gray-600 text-lg">›</span>
        </Link>
      </div>
    </div>
  );
}
