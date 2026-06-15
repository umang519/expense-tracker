"use client";

import { useEffect, useState } from "react";

function readAndClearCount(): number {
  if (typeof window === "undefined") return 0;
  const stored = sessionStorage.getItem("recurring_just_logged");
  if (!stored) return 0;
  const n = parseInt(stored, 10);
  if (n > 0) sessionStorage.removeItem("recurring_just_logged");
  return n > 0 ? n : 0;
}

export default function RecurringLoggedBanner() {
  // Lazy initializer runs only on the client, never on the server
  const [count, setCount] = useState<number>(readAndClearCount);

  // Auto-dismiss after 5 s
  useEffect(() => {
    if (count === 0) return;
    const t = setTimeout(() => setCount(0), 5000);
    return () => clearTimeout(t);
  }, [count]);

  if (count === 0) return null;

  return (
    <div suppressHydrationWarning className="flex items-center gap-2.5 bg-violet-600 text-white text-sm px-4 py-2.5 rounded-2xl mb-3 shadow-sm">
      <span className="text-base leading-none">↻</span>
      <span className="flex-1 font-medium">
        {count} recurring {count === 1 ? "expense" : "expenses"} auto-logged today
      </span>
      <button
        onClick={() => setCount(0)}
        className="text-violet-200 hover:text-white text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
