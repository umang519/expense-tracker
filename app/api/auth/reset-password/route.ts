import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import User from "@/models/User";

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const otp = (body.otp ?? "").trim();
  const newPassword = body.newPassword ?? "";

  if (!email || !otp || otp.length !== 6) {
    return NextResponse.json({ error: "Email and 6-digit code are required" }, { status: 400 });
  }

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  await connectDB();

  const user = await User.findOne({ email });
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  if (!user.resetOtp || !user.resetOtpExpiresAt) {
    return NextResponse.json({ error: "No reset code found. Request a new one." }, { status: 400 });
  }

  if (user.resetOtpExpiresAt < new Date()) {
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (hashOtp(otp) !== user.resetOtp) {
    return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);

  await User.findByIdAndUpdate(user._id, {
    passwordHash,
    $unset: { resetOtp: 1, resetOtpExpiresAt: 1 },
  });

  return NextResponse.json({ ok: true });
}
