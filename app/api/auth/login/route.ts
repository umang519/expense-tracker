import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyPassword, signJWT, COOKIE_NAME } from "@/lib/auth";
import { LoginSchema } from "@/lib/validation";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = await signJWT({
    sub: user._id.toString(),
    email: user.email,
  });

  const response = NextResponse.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      currency: user.currency,
    },
  });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
