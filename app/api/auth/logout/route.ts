import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { COOKIE_NAME, REFRESH_COOKIE_NAME, hashRefreshToken } from "@/lib/auth";
import RefreshToken from "@/models/RefreshToken";

export async function POST(req: NextRequest) {
  const rawRefreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (rawRefreshToken) {
    await connectDB();
    const tokenHash = await hashRefreshToken(rawRefreshToken);
    await RefreshToken.deleteOne({ tokenHash });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
