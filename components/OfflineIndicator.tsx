"use client";

import { useSyncExternalStore } from "react";
import { getQueue, QUEUE_CHANGED_EVENT } from "@/lib/offlineQueue";

// navigator.onLine and the localStorage queue only exist in the browser. Read
// via useSyncExternalStore so the server (and the hydration pass) assume
// "online, nothing queued", then React switches to the real values without a
// hydration mismatch — a useState initializer would also run during SSR.
function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  window.addEventListener(QUEUE_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
    window.removeEventListener(QUEUE_CHANGED_EVENT, callback);
  };
}

const getOnline = () => navigator.onLine;
const getPendingCount = () => getQueue().length;

export default function OfflineIndicator() {
  const online = useSyncExternalStore(subscribe, getOnline, () => true);
  const pendingCount = useSyncExternalStore(subscribe, getPendingCount, () => 0);

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
