import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { sendEmail, otpEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import User from "@/models/User";

function generateOtp() {
  return String(Math.floor(100000 + crypto.randomInt(900000)));
}

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit("resend-verification", getClientIp(req), 5, 60 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  await connectDB();

  const user = await User.findOne({ email });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (user.isEmailVerified) {
    return NextResponse.json({ error: "Email already verified" }, { status: 400 });
  }

  // 60-second cooldown: OTP expires in 15 min, so if expiresAt > now + 14min it was just sent
  if (user.verifyOtpExpiresAt && user.verifyOtpExpiresAt.getTime() > Date.now() + 14 * 60 * 1000) {
    return NextResponse.json({ error: "Please wait 60 seconds before requesting a new code" }, { status: 429 });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await User.findByIdAndUpdate(user._id, {
    verifyOtp: hashOtp(otp),
    verifyOtpExpiresAt: expiresAt,
  });

  try {
    const { html, text } = otpEmail(otp, "Here is your new verification code for Outlay.");
    await sendEmail({ to: user.email, subject: "New verification code — Outlay", html, text });
  } catch {
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
