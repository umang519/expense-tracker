"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The root route ("/") is the PWA's start_url. It must always resolve with a
// real 200 response — some Android WebAPK versions crash/close on cold launch
// if start_url issues a network-level redirect (see app/manifest.ts and the
// git history on app/page.tsx). So an authenticated session can't just call
// next/navigation's redirect() from the server component: that sends an HTTP
// 307 for the very first request, which is the exact case that was crashing.
// Instead the server renders this small client shell (a real 200), and the
// redirect happens here via the History API after mount — no network hop.
export default function AuthedHomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 text-white text-2xl font-bold animate-pulse">
        O
      </div>
    </main>
  );
}
