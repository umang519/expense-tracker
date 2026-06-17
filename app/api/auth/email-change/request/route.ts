import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { sendEmail, otpEmailHtml } from "@/lib/email";
import User from "@/models/User";

function generateOtp() {
  return String(Math.floor(100000 + crypto.randomInt(900000)));
}

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const newEmail = (body.email ?? "").trim().toLowerCase();

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  await connectDB();

  const existing = await User.findOne({ email: newEmail });
  if (existing) {
    return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
  }

  const otp = generateOtp();
  const hashed = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await User.findByIdAndUpdate(user.userId, {
    pendingEmail: newEmail,
    emailOtp: hashed,
    emailOtpExpiresAt: expiresAt,
  });

  await sendEmail({
    to: newEmail,
    subject: "Verify your new email — Expense Tracker",
    html: otpEmailHtml(otp, `Enter this code to confirm <strong>${newEmail}</strong> as your new email address.`),
  });

  return NextResponse.json({ ok: true });
}
