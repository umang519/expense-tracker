import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  if (!token || !(await verifyJWT(token))) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/month/:path*", "/reports/:path*", "/categories/:path*", "/transactions/:path*", "/settings/:path*"],
};
