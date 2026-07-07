"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "./PasswordInput";
import NotificationToggle from "./NotificationToggle";
import SignOutModal from "./SignOutModal";
import DeleteAccountModal from "./DeleteAccountModal";

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
}

export default function SettingsForm({ user }: { user: User }) {
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
      <section className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Profile
        </h2>

        {/* Avatar + email */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-lg flex-shrink-0">
            {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{user.name || "—"}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Your name"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <StatusButton status={profileStatus} label="Save name" />
        </form>
      </section>

      {/* Currency */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Preferences
        </h2>
        <form onSubmit={saveCurrency} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
            >
              {CURRENCIES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              Changes only the symbol shown — amounts are not converted between currencies.
            </p>
          </div>
          <StatusButton status={currencyStatus} label="Save currency" />
        </form>
      </section>

      {/* Security */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Security
        </h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Current password
            </label>
            <PasswordInput
              required
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); clearPwFieldError("current"); }}
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="••••••••"
            />
            {pwFieldErrors.current && (
              <p className="text-xs text-red-600 mt-1">{pwFieldErrors.current}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              New password
            </label>
            <PasswordInput
              required
              value={newPw}
              onChange={(e) => { setNewPw(e.target.value); clearPwFieldError("new"); }}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Min 8 characters"
            />
            {pwFieldErrors.new && (
              <p className="text-xs text-red-600 mt-1">{pwFieldErrors.new}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Confirm new password
            </label>
            <PasswordInput
              required
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); clearPwFieldError("confirm"); }}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="••••••••"
            />
            {pwFieldErrors.confirm && (
              <p className="text-xs text-red-600 mt-1">{pwFieldErrors.confirm}</p>
            )}
          </div>
          <StatusButton status={pwStatus} label="Change password" />
        </form>
      </section>

      {/* Update email */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Update Email
        </h2>

        <p className="text-xs text-gray-400 mb-4">
          Current: <span className="text-gray-600 font-medium">{user.email}</span>
        </p>

        {emailStep === "idle" && (
          <button
            onClick={() => { setEmailStep("form"); setEmailStatus("idle"); }}
            className="w-full py-2.5 rounded-xl border border-violet-200 text-violet-600 hover:bg-violet-50 text-sm font-medium transition-colors"
          >
            Change email address
          </button>
        )}

        {emailStep === "form" && (
          <form onSubmit={requestEmailChange} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New email address</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setEmailStatus("idle"); }}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            {typeof emailStatus === "string" && emailStatus !== "idle" && emailStatus !== "sending" && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{emailStatus}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEmailStep("idle"); setNewEmail(""); setEmailStatus("idle"); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
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
            <p className="text-xs text-gray-500">
              We sent a 6-digit code to <span className="font-medium text-gray-700">{newEmail}</span>. Enter it below.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={emailOtp}
              onChange={(e) => { setEmailOtp(e.target.value.replace(/\D/g, "")); setEmailStatus("idle"); }}
              placeholder="000000"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            {typeof emailStatus === "string" && emailStatus !== "idle" && emailStatus !== "verifying" && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{emailStatus}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEmailStep("form"); setEmailOtp(""); setEmailStatus("idle"); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
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
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
        <a
          href="/recurring"
          className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500 flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 2.1l4 4-4 4" />
                <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
                <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Recurring Expenses</p>
              <p className="text-xs text-gray-400">Auto-log rent, SIPs &amp; subscriptions</p>
            </div>
          </div>
          <span className="text-gray-300 text-lg">›</span>
        </a>
      </section>

      {/* Sign out */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Account
        </h2>
        <button
          onClick={() => setSignOutOpen(true)}
          className="w-full py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors"
        >
          Sign out
        </button>
        <button
          onClick={() => setDeleteAccountOpen(true)}
          className="w-full py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors mt-2"
        >
          Delete account
        </button>
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
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{status}</p>
      )}
      {status === "saved" && (
        <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-1.5">
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
