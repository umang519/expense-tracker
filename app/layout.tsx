import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NO_FLASH_THEME_SCRIPT } from "@/lib/theme";
import NotificationFallbackTrigger from "@/components/NotificationFallbackTrigger";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outlay — Track expenses in seconds",
  description: "A free, open-source expense tracker. Fast mobile entry, budgets, reports, and offline support.",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Outlay",
  },
  openGraph: {
    title: "Outlay — Track expenses in seconds",
    description: "A free, open-source expense tracker. Fast mobile entry, budgets, reports, and offline support.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Outlay — Track expenses in seconds",
    description: "A free, open-source expense tracker. Fast mobile entry, budgets, reports, and offline support.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Server-rendered <script> in a Server Component: React 19 hoists this into
            the streamed HTML's <head> and runs it before hydration, so the correct
            theme class is set before first paint without going through next/script's
            client-side injection (which triggers React 19's script-tag warning). */}
        <script
          id="theme-script"
          dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        <NotificationFallbackTrigger />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
