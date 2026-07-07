"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "resending" | string>("idle");
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!email) router.replace("/register");
  }, [email, router]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCooldown() {
    setCooldown(60);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setStatus(d.error ?? "Verification failed");
      }
    } catch {
      setStatus("Network error. Please try again.");
    }
  }

  async function handleResend() {
    setStatus("resending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("idle");
        setOtp("");
        startCooldown();
      } else {
        setStatus(d.error ?? "Failed to resend code");
      }
    } catch {
      setStatus("Network error. Please try again.");
    }
  }

  const isError = status !== "idle" && status !== "verifying" && status !== "resending";

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Check your email</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">We sent a 6-digit code to</p>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-6">{email}</p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setStatus("idle"); }}
              placeholder="000000"
              className="w-full px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-center tracking-widest font-mono text-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {isError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{status}</p>
          )}

          <button
            type="submit"
            disabled={otp.length !== 6 || status === "verifying"}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {status === "verifying" ? "Verifying…" : "Verify email"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Didn&apos;t receive it?</p>
          {cooldown > 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Resend in {cooldown}s</p>
          ) : (
            <button
              onClick={handleResend}
              disabled={status === "resending"}
              className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline disabled:opacity-50"
            >
              {status === "resending" ? "Sending…" : "Resend code"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
