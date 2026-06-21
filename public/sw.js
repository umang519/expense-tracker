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
