"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getStoredTheme, setStoredTheme, applyTheme, subscribeTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, () => "system" as ThemePreference);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setStoredTheme(value)}
          aria-pressed={theme === value}
          className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
            theme === value
              ? "bg-violet-600 border-violet-600 text-white"
              : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
