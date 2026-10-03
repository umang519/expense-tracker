import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import {
  signJWT,
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashRefreshToken,
} from "@/lib/auth";
import { resolveRole } from "@/lib/adminAccess";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import User from "@/models/User";
import RefreshToken from "@/models/RefreshToken";

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

const TOO_MANY = { error: "Too many attempts. Please try again in 15 minutes." };

export async function POST(req: NextRequest) {
  const ipAllowed = await checkRateLimit("verify-email", getClientIp(req), 10, 15 * 60);
  if (!ipAllowed) return NextResponse.json(TOO_MANY, { status: 429 });

  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const otp = (body.otp ?? "").trim();

  if (!email || !otp || otp.length !== 6) {
    return NextResponse.json({ error: "Email and 6-digit code are required" }, { status: 400 });
  }

  // Per-account cap is what actually stops brute-forcing the 6-digit code:
  // the IP limit alone is bypassed by rotating IPs. 5 guesses per 15 min
  // against a code space of 900k makes guessing infeasible.
  const accountAllowed = await checkRateLimit("verify-email-account", email, 5, 15 * 60);
  if (!accountAllowed) return NextResponse.json(TOO_MANY, { status: 429 });

  await connectDB();

  const user = await User.findOne({ email });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (user.isEmailVerified) {
    return NextResponse.json({ error: "Email already verified. Please log in." }, { status: 400 });
  }

  if (!user.verifyOtp || !user.verifyOtpExpiresAt) {
    return NextResponse.json({ error: "No verification code found. Request a new one." }, { status: 400 });
  }

  if (user.verifyOtpExpiresAt < new Date()) {
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (hashOtp(otp) !== user.verifyOtp) {
    return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
  }

  await User.findByIdAndUpdate(user._id, {
    isEmailVerified: true,
    $unset: { verifyOtp: 1, verifyOtpExpiresAt: 1 },
  });

  const role = await resolveRole(user);
  const token = await signJWT({ sub: user._id.toString(), email: user.email, role });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  // Verifying email completes signup on the device the user is already on —
  // treat it like "remember me" checked, same as the register→login flow would.
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = await hashRefreshToken(rawRefreshToken);
  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
  });
  response.cookies.set(REFRESH_COOKIE_NAME, rawRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  return response;
}
