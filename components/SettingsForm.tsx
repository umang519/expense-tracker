"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "./PasswordInput";
import NotificationToggle from "./NotificationToggle";
import SignOutModal from "./SignOutModal";
import DeleteAccountModal from "./DeleteAccountModal";
import ThemeToggle from "./ThemeToggle";

const CURRENCIES = [
  { code: "INR", label: "₹ Indian Rupee" },
  { code: "USD", label: "$ US Dollar" },
  { code: "EUR", label: "€ Euro" },
  { code: "GBP", label: "£ British Pound" },
  { code: "AED", label: "AED UAE Dirham" },
  { code: "SGD", label: "S$ Singapore Dollar" },
  { code: "JPY", label: "¥ Japanese Yen" },
  { code: "AUD", label: "A$ Australian Dollar" },
  { code: "CAD", label: "C$ Canadian Dollar" },
];

interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
  avatarUrl?: string;
}

export default function SettingsForm({ user, appVersion }: { user: User; appVersion: string }) {
  const router = useRouter();

  // ── Profile ────────────────────────────────────────────────────────────────
  const [name, setName] = useState(user.name);
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "saved" | string>("idle");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) { setProfileStatus("You're offline. Connect to save changes."); return; }
    setProfileStatus("saving");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      if (res.ok) {
        setProfileStatus("saved");
        router.refresh();
        setTimeout(() => setProfileStatus("idle"), 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        setProfileStatus(d.error ?? "Failed to save");
      }
    } catch {
      setProfileStatus("Network error. Please try again.");
    }
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "uploading" | "removing" | string>("idle");

  async function uploadAvatar(file: File) {
    if (!navigator.onLine) { setAvatarStatus("You're offline. Connect to upload."); return; }
    if (!file.type.startsWith("image/")) { setAvatarStatus("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarStatus("Image must be under 5MB"); return; }

    setAvatarStatus("uploading");
    try {
      const sigRes = await fetch("/api/auth/avatar-signature", { method: "POST" });
      if (!sigRes.ok) {
        const d = await sigRes.json().catch(() => ({}));
        setAvatarStatus(d.error ?? "Failed to start upload");
        return;
      }
      const { signature, timestamp, folder, apiKey, cloudName } = await sigRes.json();

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
      form.append("folder", folder);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: form,
      });
      const uploaded = await uploadRes.json();
      if (!uploadRes.ok) {
        setAvatarStatus(uploaded.error?.message ?? "Upload failed");
        return;
      }

      const saveRes = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: uploaded.secure_url, avatarPublicId: uploaded.public_id }),
      });
      if (saveRes.ok) {
        setAvatarUrl(uploaded.secure_url);
        setAvatarStatus("idle");
        router.refresh();
      } else {
        const d = await saveRes.json().catch(() => ({}));
        setAvatarStatus(d.error ?? "Failed to save picture");
      }
    } catch {
      setAvatarStatus("Network error. Please try again.");
    }
  }

  async function removeAvatar() {
    if (!navigator.onLine) { setAvatarStatus("You're offline. Connect to save changes."); return; }
    setAvatarStatus("removing");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null, avatarPublicId: null }),
      });
      if (res.ok) {
        setAvatarUrl(undefined);
        setAvatarStatus("idle");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setAvatarStatus(d.error ?? "Failed to remove picture");
      }
    } catch {
      setAvatarStatus("Network error. Please try again.");
    }
  }

  // ── Currency ───────────────────────────────────────────────────────────────
  const [currency, setCurrency] = useState(user.currency);
  const [currencyStatus, setCurrencyStatus] = useState<"idle" | "saving" | "saved" | string>("idle");

  async function saveCurrency(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) { setCurrencyStatus("You're offline. Connect to save changes."); return; }
    setCurrencyStatus("saving");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });
      if (res.ok) {
        setCurrencyStatus("saved");
        router.refresh();
        setTimeout(() => setCurrencyStatus("idle"), 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        setCurrencyStatus(d.error ?? "Failed to save");
      }
    } catch {
      setCurrencyStatus("Network error. Please try again.");
    }
  }

  // ── Password ───────────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwFieldErrors, setPwFieldErrors] = useState({ current: "", new: "", confirm: "" });
  const [pwStatus, setPwStatus] = useState<"idle" | "saving" | "saved" | string>("idle");

  function clearPwFieldError(field: keyof typeof pwFieldErrors) {
    setPwFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwFieldErrors({ current: "", new: "", confirm: "" });

    if (newPw.length < 8) {
      setPwFieldErrors((prev) => ({ ...prev, new: "Password must be at least 8 characters" }));
      return;
    }
    if (newPw !== confirmPw) {
      setPwFieldErrors((prev) => ({ ...prev, confirm: "Passwords do not match" }));
      return;
    }

    if (!navigator.onLine) { setPwStatus("You're offline. Connect to change password."); return; }
    setPwStatus("saving");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (res.ok) {
        setPwStatus("saved");
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        setTimeout(() => setPwStatus("idle"), 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        const msg: string = d.error ?? "Failed to change password";
        if (msg.toLowerCase().includes("current") || msg.toLowerCase().includes("incorrect") || msg.toLowerCase().includes("wrong")) {
          setPwFieldErrors((prev) => ({ ...prev, current: msg }));
          setPwStatus("idle");
        } else {
          setPwStatus(msg);
        }
      }
    } catch {
      setPwStatus("Network error. Please try again.");
    }
  }

  // ── Email change ───────────────────────────────────────────────────────────
  const [emailStep, setEmailStep] = useState<"idle" | "form" | "otp">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "verifying" | string>("idle");

  async function requestEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus("sending");
    try {
      const res = await fetch("/api/auth/email-change/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      if (res.ok) {
        setEmailStep("otp");
        setEmailStatus("idle");
      } else {
        const d = await res.json().catch(() => ({}));
        setEmailStatus(d.error ?? "Failed to send code");
      }
    } catch {
      setEmailStatus("Network error. Please try again.");
    }
  }

  async function confirmEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus("verifying");
    try {
      const res = await fetch("/api/auth/email-change/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: emailOtp }),
      });
      if (res.ok) {
        setEmailStep("idle");
        setNewEmail("");
        setEmailOtp("");
        setEmailStatus("idle");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setEmailStatus(d.error ?? "Verification failed");
      }
    } catch {
      setEmailStatus("Network error. Please try again.");
    }
  }

  // ── Sign out modal ─────────────────────────────────────────────────────────
  const [signOutOpen, setSignOutOpen] = useState(false);

  // ── Delete account modal ──────────────────────────────────────────────────
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Profile */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Profile
        </h2>

        {/* Avatar + email */}
        <div className="flex items-center gap-3 mb-5">
          <label className="relative w-12 h-12 flex-shrink-0 cursor-pointer group">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, app has no other next/image usage
              <img
                src={avatarUrl}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-lg">
                {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
              </div>
            )}
            {/* Always-visible badge (not hover-only — hover state doesn't exist on touch devices) */}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-violet-600 border-2 border-white dark:border-gray-900 flex items-center justify-center group-hover:bg-violet-700 group-active:bg-violet-700 transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={avatarStatus === "uploading" || avatarStatus === "removing"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) uploadAvatar(file);
              }}
            />
          </label>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user.name || "—"}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
          </div>
          {avatarUrl && avatarStatus !== "uploading" && avatarStatus !== "removing" && (
            <button
              type="button"
              onClick={removeAvatar}
              className="text-xs text-red-500 dark:text-red-400 hover:underline flex-shrink-0"
            >
              Remove
            </button>
          )}
        </div>
        {avatarStatus === "uploading" && (
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-3 mb-4">Uploading…</p>
        )}
        {avatarStatus === "removing" && (
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-3 mb-4">Removing…</p>
        )}
        {avatarStatus !== "idle" && avatarStatus !== "uploading" && avatarStatus !== "removing" && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-1.5 -mt-3 mb-4">
            {avatarStatus}
          </p>
        )}

        <form onSubmit={saveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Your name"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <StatusButton status={profileStatus} label="Save name" />
        </form>
      </section>

      {/* Currency */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Preferences
        </h2>
        <form onSubmit={saveCurrency} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white dark:bg-gray-900"
            >
              {CURRENCIES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              Changes only the symbol shown — amounts are not converted between currencies.
            </p>
          </div>
          <StatusButton status={currencyStatus} label="Save currency" />
        </form>

        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Appearance
          </label>
          <ThemeToggle />
        </div>
      </section>

      {/* Security */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Security
        </h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Current password
            </label>
            <PasswordInput
              required
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); clearPwFieldError("current"); }}
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="••••••••"
            />
            {pwFieldErrors.current && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{pwFieldErrors.current}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              New password
            </label>
            <PasswordInput
              required
              value={newPw}
              onChange={(e) => { setNewPw(e.target.value); clearPwFieldError("new"); }}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Min 8 characters"
            />
            {pwFieldErrors.new && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{pwFieldErrors.new}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Confirm new password
            </label>
            <PasswordInput
              required
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); clearPwFieldError("confirm"); }}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="••••••••"
            />
            {pwFieldErrors.confirm && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{pwFieldErrors.confirm}</p>
            )}
          </div>
          <StatusButton status={pwStatus} label="Change password" />
        </form>
      </section>

      {/* Update email */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Update Email
        </h2>

        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          Current: <span className="text-gray-600 dark:text-gray-400 font-medium">{user.email}</span>
        </p>

        {emailStep === "idle" && (
          <button
            onClick={() => { setEmailStep("form"); setEmailStatus("idle"); }}
            className="w-full py-2.5 rounded-xl border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 text-sm font-medium transition-colors"
          >
            Change email address
          </button>
        )}

        {emailStep === "form" && (
          <form onSubmit={requestEmailChange} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New email address</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setEmailStatus("idle"); }}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            {typeof emailStatus === "string" && emailStatus !== "idle" && emailStatus !== "sending" && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-1.5">{emailStatus}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEmailStep("idle"); setNewEmail(""); setEmailStatus("idle"); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={emailStatus === "sending"}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {emailStatus === "sending" ? "Sending…" : "Send code"}
              </button>
            </div>
          </form>
        )}

        {emailStep === "otp" && (
          <form onSubmit={confirmEmailChange} className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              We sent a 6-digit code to <span className="font-medium text-gray-700 dark:text-gray-300">{newEmail}</span>. Enter it below.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={emailOtp}
              onChange={(e) => { setEmailOtp(e.target.value.replace(/\D/g, "")); setEmailStatus("idle"); }}
              placeholder="000000"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            {typeof emailStatus === "string" && emailStatus !== "idle" && emailStatus !== "verifying" && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-1.5">{emailStatus}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEmailStep("form"); setEmailOtp(""); setEmailStatus("idle"); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={emailStatus === "verifying" || emailOtp.length !== 6}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {emailStatus === "verifying" ? "Verifying…" : "Confirm"}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Notifications */}
      <NotificationToggle />

      {/* Quick links */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-50 dark:divide-gray-800">
        <a
          href="/recurring"
          className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-500 dark:text-violet-400 flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 2.1l4 4-4 4" />
                <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
                <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Recurring Expenses</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Auto-log rent, SIPs &amp; subscriptions</p>
            </div>
          </div>
          <span className="text-gray-300 dark:text-gray-600 text-lg">›</span>
        </a>
        <a
          href="/reports"
          className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-500 dark:text-violet-400 flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15V3M12 15l-4-4M12 15l4-4" />
                <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Reports &amp; Export</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Yearly trends and CSV downloads</p>
            </div>
          </div>
          <span className="text-gray-300 dark:text-gray-600 text-lg">›</span>
        </a>
      </section>

      {/* Sign out */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Account
        </h2>
        <button
          onClick={() => setSignOutOpen(true)}
          className="w-full py-2.5 rounded-xl border-2 border-red-200 dark:border-red-800/60 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-medium transition-colors"
        >
          Sign out
        </button>
        <button
          onClick={() => setDeleteAccountOpen(true)}
          className="w-full py-2.5 rounded-xl border-2 border-red-200 dark:border-red-800/60 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-medium transition-colors mt-2"
        >
          Delete account
        </button>
      </section>

      {/* About */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          About
        </h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Expense Tracker</span>
          <span className="text-gray-400 dark:text-gray-500 font-mono">v{appVersion}</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Your data is private to your account — no one else can see or access it.
        </p>
      </section>

      <SignOutModal isOpen={signOutOpen} onClose={() => setSignOutOpen(false)} />
      <DeleteAccountModal isOpen={deleteAccountOpen} onClose={() => setDeleteAccountOpen(false)} />
    </div>
  );
}

// ── Reusable status button ─────────────────────────────────────────────────────

function StatusButton({
  status,
  label,
}: {
  status: "idle" | "saving" | "saved" | string;
  label: string;
}) {
  const isError = status !== "idle" && status !== "saving" && status !== "saved";
  return (
    <div className="space-y-1.5">
      {isError && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-1.5">{status}</p>
      )}
      {status === "saved" && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-1.5">
          Saved successfully
        </p>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
      >
        {status === "saving" ? "Saving…" : label}
      </button>
    </div>
  );
}
