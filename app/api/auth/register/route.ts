import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { RegisterSchema } from "@/lib/validation";
import { sendEmail, otpEmail } from "@/lib/email";
import User from "@/models/User";
import Category from "@/models/Category";

const DEFAULT_CATEGORIES = [
  { name: "Food", color: "#F97316", sortOrder: 0 },
  { name: "Travel", color: "#3B82F6", sortOrder: 1 },
  { name: "Investments", color: "#10B981", sortOrder: 2 },
  { name: "Extras", color: "#8B5CF6", sortOrder: 3 },
];

function generateOtp() {
  return String(Math.floor(100000 + crypto.randomInt(900000)));
}

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { email, password, name } = parsed.data;

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const otp = generateOtp();
  const hashed = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const user = await User.create({
    email,
    passwordHash,
    name,
    isEmailVerified: false,
    verifyOtp: hashed,
    verifyOtpExpiresAt: expiresAt,
  });

  await Category.insertMany(
    DEFAULT_CATEGORIES.map((cat) => ({ ...cat, userId: user._id }))
  );

  try {
    const { html, text } = otpEmail(otp, "Enter this code to verify your email and activate your Expense Tracker account.");
    await sendEmail({
      to: user.email,
      subject: "Verify your email — Expense Tracker",
      html,
      text,
    });
  } catch {
    await User.findByIdAndDelete(user._id);
    return NextResponse.json({ error: "Failed to send verification email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ email: user.email }, { status: 201 });
}
