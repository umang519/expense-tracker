import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  verifyPassword,
  signJWT,
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashRefreshToken,
} from "@/lib/auth";
import { LoginSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import User from "@/models/User";
import RefreshToken from "@/models/RefreshToken";

export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit("login", getClientIp(req), 10, 15 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { email, password, rememberMe } = parsed.data;

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
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  if (rememberMe) {
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
  }

  return response;
}
