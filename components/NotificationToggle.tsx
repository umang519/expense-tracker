"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// Synchronous checks run only on the client (lazy initializer)
function getInitialStatus(): Status {
  if (typeof window === "undefined") return "loading";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "loading"; // async check needed
}

export default function NotificationToggle() {
  const [status, setStatus] = useState<Status>(getInitialStatus);
  const [busy, setBusy] = useState(false);

  // Async: find out if the user already has an active subscription
  useEffect(() => {
    if (status !== "loading") return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "subscribed" : "unsubscribed");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch("/api/push/vapid-key");
      const { publicKey } = await res.json();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        }),
      });
      setStatus("subscribed");
    } catch {
      if (Notification.permission === "denied") setStatus("denied");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return null;

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
        Daily Reminder
      </h2>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-500 dark:text-violet-400 flex-shrink-0 mt-0.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Evening nudge</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {status === "subscribed"
              ? "You'll get a reminder at 7:30 PM to log your expenses."
              : status === "denied"
              ? "Notifications are blocked. Enable them in your browser settings."
              : status === "unsupported"
              ? "Push notifications aren't supported in this browser."
              : "Get a gentle daily reminder to log your expenses."}
          </p>
        </div>

        {status === "subscribed" && (
          <button
            onClick={unsubscribe}
            disabled={busy}
            className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-700 rounded-xl px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {busy ? "…" : "Turn off"}
          </button>
        )}
        {status === "unsubscribed" && (
          <button
            onClick={subscribe}
            disabled={busy}
            className="flex-shrink-0 text-xs text-white bg-violet-600 hover:bg-violet-700 rounded-xl px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {busy ? "…" : "Turn on"}
          </button>
        )}
      </div>
    </section>
  );
}
