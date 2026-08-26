import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, REFRESH_COOKIE_NAME } from "@/lib/auth";

function extractCookieValue(setCookies: string[], name: string): string | undefined {
  for (const setCookie of setCookies) {
    const pair = setCookie.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (pair.slice(0, eq) === name) return pair.slice(eq + 1);
  }
  return undefined;
}

// Merges freshly-refreshed Set-Cookie values into THIS request's own cookie
// header, not just the outgoing response's. Every protected page (dashboard,
// month, reports, categories, transactions, settings, admin) independently
// re-verifies the JWT itself via cookies() — without forwarding the refresh
// into the request, that render still sees the old expired token and
// redirects to /login on this very navigation, even though the refresh above
// just succeeded. That silently defeated "remember me": once a day
// (access-token TTL), the first page load after expiry bounced to /login
// regardless of a valid 30-day refresh session.
function withRefreshedCookies(req: NextRequest, setCookies: string[]): Headers {
  const cookieJar = new Map<string, string>();
  for (const pair of (req.headers.get("cookie") ?? "").split(";")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    cookieJar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const setCookie of setCookies) {
    const pair = setCookie.split(";", 1)[0];
    const eq = pair.indexOf("=");
    cookieJar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const headers = new Headers(req.headers);
  headers.set("cookie", Array.from(cookieJar, ([k, v]) => `${k}=${v}`).join("; "));
  return headers;
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyJWT(token) : null;
  const isRoot = req.nextUrl.pathname === "/";

  if (payload) {
    // Edge runtime can't hit Mongoose to re-check role, so the claim has to
    // travel in the token — same reasoning as the refresh-token flow. A stale
    // pre-refresh token without a role claim fails closed (redirects away),
    // not open.
    if (req.nextUrl.pathname.startsWith("/admin") && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Access JWT missing/expired — if a "remember me" refresh cookie is present,
  // try a silent refresh (which does the DB lookup itself; middleware stays
  // edge-only) before falling back to a hard redirect to /login.
  const hasRefreshCookie = Boolean(req.cookies.get(REFRESH_COOKIE_NAME)?.value);
  if (hasRefreshCookie) {
    const refreshRes = await fetch(new URL("/api/auth/refresh", req.url), {
      method: "POST",
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });

    if (refreshRes.ok) {
      const setCookies = refreshRes.headers.getSetCookie?.() ?? [];

      if (req.nextUrl.pathname.startsWith("/admin")) {
        const newToken = extractCookieValue(setCookies, "token");
        const newPayload = newToken ? await verifyJWT(newToken) : null;
        if (newPayload?.role !== "admin") {
          const redirectResponse = NextResponse.redirect(new URL("/dashboard", req.url));
          for (const cookie of setCookies) redirectResponse.headers.append("set-cookie", cookie);
          return redirectResponse;
        }
      }

      const response = NextResponse.next({
        request: { headers: withRefreshedCookies(req, setCookies) },
      });
      for (const cookie of setCookies) {
        response.headers.append("set-cookie", cookie);
      }
      return response;
    }
  }

  // "/" is the PWA start_url and also the public landing page — never force a
  // login redirect from here. Fall through so app/page.tsx renders (it does
  // its own, non-redirecting auth check — see its comment on AuthedHomeRedirect).
  if (isRoot) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/month/:path*", "/reports/:path*", "/categories/:path*", "/transactions/:path*", "/settings/:path*", "/admin/:path*"],
};
