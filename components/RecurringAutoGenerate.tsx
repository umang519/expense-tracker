"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function RecurringAutoGenerate() {
  const qc = useQueryClient();

  useEffect(() => {
    if (sessionStorage.getItem("recurring_generated")) return;

    fetch("/api/recurring/generate", { method: "POST" })
      .then((r) => r.json())
      .then((data: { generated?: number }) => {
        sessionStorage.setItem("recurring_generated", "1");
        if ((data.generated ?? 0) > 0) {
          // New expenses were created — invalidate so lists/summaries refresh
          qc.invalidateQueries({ queryKey: ["expenses"] });
          qc.invalidateQueries({ queryKey: ["summary"] });
        }
      })
      .catch(() => {/* silent — non-critical */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
