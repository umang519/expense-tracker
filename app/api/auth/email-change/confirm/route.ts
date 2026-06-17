import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import User from "@/models/User";

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const otp = (body.otp ?? "").trim();

  if (!otp || otp.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  }

  await connectDB();

  const doc = await User.findById(user.userId);
  if (!doc || !doc.pendingEmail || !doc.emailOtp || !doc.emailOtpExpiresAt) {
    return NextResponse.json({ error: "No pending email change. Request a new code." }, { status: 400 });
  }

  if (doc.emailOtpExpiresAt < new Date()) {
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (hashOtp(otp) !== doc.emailOtp) {
    return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
  }

  await User.findByIdAndUpdate(user.userId, {
    email: doc.pendingEmail,
    $unset: { pendingEmail: 1, emailOtp: 1, emailOtpExpiresAt: 1 },
  });

  return NextResponse.json({ ok: true, email: doc.pendingEmail });
}
