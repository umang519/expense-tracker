import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { signJWT, COOKIE_NAME } from "@/lib/auth";
import User from "@/models/User";

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const otp = (body.otp ?? "").trim();

  if (!email || !otp || otp.length !== 6) {
    return NextResponse.json({ error: "Email and 6-digit code are required" }, { status: 400 });
  }

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

  const token = await signJWT({ sub: user._id.toString(), email: user.email });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
