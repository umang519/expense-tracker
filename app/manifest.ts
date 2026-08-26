import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Explicit, stable app identity — without this, Android's installed WebAPK
    // derives its identity from start_url, and a manifest name/short_name
    // change (like the Outlay rename) can leave an already-installed home
    // screen icon out of sync with what the server now serves, causing the
    // installed app to fail to launch. Pinning `id` here means future
    // renames won't repeat that: existing installs keep resolving correctly
    // as long as `id` itself never changes.
    // `id` stays independent of `start_url` by design (spec-intended) — do not
    // change this even if `start_url` changes again later, since existing
    // installs resolve their identity against `id`, not `start_url`.
    id: "/dashboard",
    name: "Outlay",
    short_name: "Outlay",
    description: "Track your daily expenses — fast, mobile-first, private.",
    // Deliberately "/" and NOT "/dashboard": some Android WebAPK versions have
    // had real bugs failing to reliably follow a redirect on cold launch, and
    // "/dashboard" always 307-redirects to "/login" for a logged-out session —
    // exactly the state right after a fresh install. "/" (app/page.tsx) always
    // returns a real 200, for both logged-out and logged-in sessions — an
    // authenticated visitor gets redirected to /dashboard client-side
    // (AuthedHomeRedirect) rather than via an HTTP redirect, so start_url never
    // triggers the cold-launch redirect bug regardless of auth state.
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#7c3aed",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
