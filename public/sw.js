const CACHE_VERSION = "v3";
const STATIC_CACHE = `et-static-${CACHE_VERSION}`;
const API_CACHE = `et-api-${CACHE_VERSION}`;
const PAGES_CACHE = `et-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// ── Install: pre-cache offline page and icons ────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png"]))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: evict old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("et-") && !k.endsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ──────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Next.js static chunks have content-hashed filenames — safe to cache forever
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Public images and icons
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // API GET requests: serve from network, cache for offline fallback
  if (url.pathname.startsWith("/api/") && request.method === "GET") {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Navigation requests: network-first, cache the page HTML, fall back to
  // cached HTML for that URL, then generic offline page as last resort
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigate(request));
    return;
  }
});

async function networkFirstNavigate(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try exact URL match first, then fall back to offline page
    const cached = await caches.match(request);
    if (cached) return cached;
    return (await caches.match(OFFLINE_URL)) ?? new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const fallback = await caches.match(OFFLINE_URL);
    return fallback ?? new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "You are offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ── Skip-waiting message from client ────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ── Push notifications (existing) ────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Expense Tracker", {
      body: data.body ?? "Don't forget to log today's expenses!",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "daily-reminder",
      renotify: false,
      data: { url: "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow("/dashboard");
      })
  );
});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// Browsers periodically rotate/expire a push subscription's endpoint on their
// own (security hygiene, long inactivity, etc). Without this handler the old
// endpoint just goes dead and the user silently stops getting notifications
// despite still showing "permission granted" — this re-subscribes and tells
// the server about the new endpoint automatically.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldEndpoint = event.oldSubscription?.endpoint;

      let applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
      if (!applicationServerKey) {
        const res = await fetch("/api/push/vapid-key");
        const { publicKey } = await res.json();
        applicationServerKey = urlBase64ToUint8Array(publicKey);
      }

      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const json = newSub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: newSub.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        }),
      });

      if (oldEndpoint) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: oldEndpoint }),
        });
      }
    })()
  );
});
