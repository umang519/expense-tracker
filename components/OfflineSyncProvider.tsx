"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flushQueue } from "@/lib/offlineQueue";

export default function OfflineSyncProvider() {
  const qc = useQueryClient();

  async function syncQueue() {
    const synced = await flushQueue();
    if (synced > 0) {
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
