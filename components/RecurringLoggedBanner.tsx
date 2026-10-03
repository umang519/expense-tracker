"use client";

import { useEffect, useSyncExternalStore } from "react";

// sessionStorage only exists in the browser, so this is read via
// useSyncExternalStore: the server (and the hydration pass) render nothing,
// then React switches to the real count without a hydration mismatch. The
// stored value is consumed into `count` once, so a later visit doesn't
// re-show an already-seen banner.
const KEY = "recurring_just_logged";
const listeners = new Set<() => void>();
let count = 0;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): number {
  const stored = sessionStorage.getItem(KEY);
  if (stored) {
    sessionStorage.removeItem(KEY);
    const n = parseInt(stored, 10);
    if (n > 0) count = n;
  }
  return count;
}

function dismiss() {
  count = 0;
  listeners.forEach((cb) => cb());
}

export default function RecurringLoggedBanner() {
  const n = useSyncExternalStore(subscribe, getSnapshot, () => 0);

  // Auto-dismiss after 5 s
  useEffect(() => {
    if (n === 0) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [n]);

  if (n === 0) return null;

  return (
    <div className="flex items-center gap-2.5 bg-violet-600 text-white text-sm px-4 py-2.5 rounded-2xl mb-3 shadow-sm">
      <span className="text-base leading-none">↻</span>
      <span className="flex-1 font-medium">
        {n} recurring {n === 1 ? "expense" : "expenses"} auto-logged today
      </span>
      <button
        onClick={dismiss}
        className="text-violet-200 hover:text-white text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
