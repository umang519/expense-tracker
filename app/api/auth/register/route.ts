import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { hashPassword, signJWT, COOKIE_NAME } from "@/lib/auth";
import { RegisterSchema } from "@/lib/validation";
import User from "@/models/User";
import Category from "@/models/Category";

const DEFAULT_CATEGORIES = [
  { name: "Food", color: "#F97316", sortOrder: 0 },
  { name: "Travel", color: "#3B82F6", sortOrder: 1 },
  { name: "Investments", color: "#10B981", sortOrder: 2 },
  { name: "Extras", color: "#8B5CF6", sortOrder: 3 },
];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, passwordHash, name });

  await Category.insertMany(
    DEFAULT_CATEGORIES.map((cat) => ({ ...cat, userId: user._id }))
  );

  const token = await signJWT({
    sub: user._id.toString(),
    email: user.email,
  });

  const response = NextResponse.json(
    {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        currency: user.currency,
      },
    },
    { status: 201 }
  );

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
