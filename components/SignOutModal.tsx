"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { flushQueue, getQueue } from "@/lib/offlineQueue";
import { clearLocalUserState } from "@/lib/clientSession";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignOutModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    // Sync offline-queued expenses while this user's session still exists —
    // after logout they'd either be lost or sync into the next account.
    if (navigator.onLine) await flushQueue();
    await fetch("/api/auth/logout", { method: "POST" });
    await clearLocalUserState();
    router.push("/login");
    router.refresh();
  }

  if (!isOpen) return null;

  // Read on open (not in state) — localStorage is client-only, and this
  // component only renders past the guard above once opened on the client.
  const pendingCount = getQueue().length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 z-10">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>

        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 text-center mb-1">
          Sign out?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          You&apos;ll need to sign in again to access your expenses.
        </p>

        {pendingCount > 0 && (
          <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 -mt-3 mb-5">
            {pendingCount} expense{pendingCount !== 1 ? "s" : ""} saved offline{" "}
            {pendingCount !== 1 ? "haven't" : "hasn't"} synced yet. We&apos;ll try to sync{" "}
            {pendingCount !== 1 ? "them" : "it"} now — if you&apos;re still offline,{" "}
            {pendingCount !== 1 ? "they" : "it"} will be lost when you sign out.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
