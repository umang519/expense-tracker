"use client";

import { useState, useEffect, useCallback } from "react";
import { getQueue, QUEUE_CHANGED_EVENT } from "@/lib/offlineQueue";

export default function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(() => {
    setOnline(navigator.onLine);
    setPendingCount(getQueue().length);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener(QUEUE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener(QUEUE_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  if (online && pendingCount === 0) return null;

  const label = online
    ? `Syncing ${pendingCount} offline expense${pendingCount !== 1 ? "s" : ""}…`
    : pendingCount > 0
    ? `Offline · ${pendingCount} expense${pendingCount !== 1 ? "s" : ""} queued`
    : "You're offline";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 py-1.5 px-4 text-center text-xs font-medium text-white ${
        online ? "bg-violet-600" : "bg-gray-800"
      }`}
    >
      {label}
    </div>
  );
}
