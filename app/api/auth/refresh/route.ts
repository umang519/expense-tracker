import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signJWT,
  generateRefreshToken,
  hashRefreshToken,
} from "@/lib/auth";
import { resolveRole } from "@/lib/adminAccess";
import User from "@/models/User";
import RefreshToken from "@/models/RefreshToken";

function clearCookies(response: NextResponse) {
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
}

// Exchanges a valid, unexpired refresh token for a new access JWT, rotating
// the refresh token itself (old hash deleted, new one issued) so a stolen
// token can only be replayed once before the rotation invalidates it.
export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!rawToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  await connectDB();

  const tokenHash = await hashRefreshToken(rawToken);
  const existing = await RefreshToken.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!existing) {
    const response = NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    clearCookies(response);
    return response;
  }

  const user = await User.findById(existing.userId).select("email role");
  if (!user) {
    await RefreshToken.deleteOne({ _id: existing._id });
    const response = NextResponse.json({ error: "User not found" }, { status: 401 });
    clearCookies(response);
    return response;
  }

  const newRawToken = generateRefreshToken();
  const newTokenHash = await hashRefreshToken(newRawToken);

  await RefreshToken.deleteOne({ _id: existing._id });
  await RefreshToken.create({
    userId: user._id,
    tokenHash: newTokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
  });

  const role = await resolveRole(user);
  const accessToken = await signJWT({ sub: user._id.toString(), email: user.email, role });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, newRawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  return response;
}
