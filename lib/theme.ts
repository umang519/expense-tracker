export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

const listeners = new Set<() => void>();

export function subscribeTheme(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setStoredTheme(pref: ThemePreference) {
  window.localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
  listeners.forEach((cb) => cb());
}

export function applyTheme(pref: ThemePreference) {
  const isDark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

// Inlined into <head> as a blocking script so the correct theme applies
// before first paint (avoids a light-mode flash on dark-preferring devices).
export const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem("${STORAGE_KEY}") || "system";
    var isDark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;
