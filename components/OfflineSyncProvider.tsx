"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getQueue, dequeue } from "@/lib/offlineQueue";

export default function OfflineSyncProvider() {
  const qc = useQueryClient();

  async function syncQueue() {
    const queue = getQueue();
    if (queue.length === 0) return;

    const succeeded: string[] = [];

    for (const item of queue) {
      try {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: item.date,
            categoryId: item.categoryId,
            amount: item.amount,
            note: item.note || undefined,
          }),
        });
        if (res.ok) succeeded.push(item.id);
      } catch {
        // Still offline for this item — leave in queue
      }
    }

    for (const id of succeeded) dequeue(id);

    if (succeeded.length > 0) {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    }
  }

  useEffect(() => {
    // Attempt sync immediately on mount (handles reload-after-reconnect)
    if (navigator.onLine) syncQueue();

    window.addEventListener("online", syncQueue);
    return () => window.removeEventListener("online", syncQueue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
