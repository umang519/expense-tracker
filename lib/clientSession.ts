import { clearQueue } from "@/lib/offlineQueue";

// Everything per-user that outlives the auth cookies on this device. Kept in
// one place so logout, account deletion and login can't drift apart.

// public/sw.js caches API responses and page HTML under these prefixes.
// "et-static-*" (hashed JS/CSS chunks, icons, offline page) holds no user
// data and is deliberately kept so the next session loads fast.
const USER_CACHE_PREFIXES = ["et-api-", "et-pages-"];

const USER_LOCAL_KEYS = ["recentCategories", "gettingStartedDismissed"];
// "recurring_generated" left set would make the *next* user signing in on the
// same tab skip their recurring generation for the rest of the session.
const USER_SESSION_KEYS = ["recurring_generated", "recurring_just_logged"];

export async function clearCachedUserData(): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => USER_CACHE_PREFIXES.some((p) => n.startsWith(p)))
        .map((n) => caches.delete(n))
    );
  } catch {
    // best-effort — a failed cache wipe must never block signing out
  }
}

// Call after logout / account deletion. Also drops the offline expense queue:
// anything still in it would otherwise sync into the next account that signs
// in on this device. Callers should try flushQueue() first.
export async function clearLocalUserState(): Promise<void> {
  await clearCachedUserData();
  clearQueue();
  for (const key of USER_LOCAL_KEYS) localStorage.removeItem(key);
  for (const key of USER_SESSION_KEYS) sessionStorage.removeItem(key);
}
