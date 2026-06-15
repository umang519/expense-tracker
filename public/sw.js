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
