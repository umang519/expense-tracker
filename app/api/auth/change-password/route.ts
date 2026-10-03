import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  getUserFromRequest,
  verifyPassword,
  hashPassword,
  hashRefreshToken,
  REFRESH_COOKIE_NAME,
} from "@/lib/auth";
import { ChangePasswordSchema } from "@/lib/validation";
import User from "@/models/User";
import RefreshToken from "@/models/RefreshToken";

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  await connectDB();

  const user = await User.findById(auth.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // Sign out every other "remember me" session, but keep this device's — the
  // user just proved they know the password here.
  const rawRefreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  const keepHash = rawRefreshToken ? await hashRefreshToken(rawRefreshToken) : null;
  await RefreshToken.deleteMany({
    userId: user._id,
    ...(keepHash ? { tokenHash: { $ne: keepHash } } : {}),
  });

  return NextResponse.json({ ok: true });
}
