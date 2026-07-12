"use client";

import { useEffect } from "react";

export default function NotificationFallbackTrigger() {
  useEffect(() => {
    if (sessionStorage.getItem("notify_check_done")) return;

    fetch("/api/push/notify-check", { method: "POST" })
      .then(() => sessionStorage.setItem("notify_check_done", "1"))
      .catch(() => {/* silent — non-critical */});
  }, []);

  return null;
}
