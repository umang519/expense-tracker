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
  const allowed = await checkRateLimit("forgot-password", getClientIp(req), 5, 60 * 60);
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

  // Always return 200 — don't reveal whether account exists
  const user = await User.findOne({ email });
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  // 60-second cooldown
  if (user.resetOtpExpiresAt && user.resetOtpExpiresAt.getTime() > Date.now() + 14 * 60 * 1000) {
    return NextResponse.json({ error: "Please wait 60 seconds before requesting a new code" }, { status: 429 });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await User.findByIdAndUpdate(user._id, {
    resetOtp: hashOtp(otp),
    resetOtpExpiresAt: expiresAt,
  });

  try {
    const { html, text } = otpEmail(otp, "Use this code to reset your Expense Tracker password. If you didn't request this, you can safely ignore this email.");
    await sendEmail({ to: user.email, subject: "Reset your password — Expense Tracker", html, text });
  } catch {
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
