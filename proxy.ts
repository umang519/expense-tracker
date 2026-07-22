import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, REFRESH_COOKIE_NAME } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (token && (await verifyJWT(token))) {
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
      const response = NextResponse.next();
      const setCookies = refreshRes.headers.getSetCookie?.() ?? [];
      for (const cookie of setCookies) {
        response.headers.append("set-cookie", cookie);
      }
      return response;
    }
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/month/:path*", "/reports/:path*", "/categories/:path*", "/transactions/:path*", "/settings/:path*"],
};
