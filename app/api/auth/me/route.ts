import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest, COOKIE_NAME } from "@/lib/auth";
import { UpdateProfileSchema } from "@/lib/validation";
import { avatarFolder, deleteCloudinaryAsset } from "@/lib/cloudinary";
import User from "@/models/User";
import Category from "@/models/Category";
import Expense from "@/models/Expense";
import Transaction from "@/models/Transaction";
import Budget from "@/models/Budget";
import RecurringExpense from "@/models/RecurringExpense";
import PushSubscription from "@/models/PushSubscription";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const user = await User.findById(auth.userId).select("-passwordHash");
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      currency: user.currency,
      avatarUrl: user.avatarUrl,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  // A new/updated avatar's publicId must live under this user's own Cloudinary folder —
  // never trust it enough to delete or reference an asset outside that scope.
  if (
    parsed.data.avatarPublicId != null &&
    !parsed.data.avatarPublicId.startsWith(`${avatarFolder(auth.userId)}/`)
  ) {
    return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
  }

  await connectDB();

  const previous = await User.findById(auth.userId).select("avatarPublicId");
  const replacingAvatar =
    ("avatarPublicId" in parsed.data) &&
    previous?.avatarPublicId &&
    previous.avatarPublicId !== parsed.data.avatarPublicId;

  const user = await User.findByIdAndUpdate(
    auth.userId,
    { $set: parsed.data },
    { new: true }
  ).select("-passwordHash");

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (replacingAvatar && previous?.avatarPublicId) {
    await deleteCloudinaryAsset(previous.avatarPublicId);
  }

  return NextResponse.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      currency: user.currency,
      avatarUrl: user.avatarUrl,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const userId = auth.userId;
  const existingUser = await User.findById(userId).select("avatarPublicId");
  await Promise.all([
    Expense.deleteMany({ userId }),
    Category.deleteMany({ userId }),
    Transaction.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    RecurringExpense.deleteMany({ userId }),
    PushSubscription.deleteMany({ userId }),
  ]);
  await User.findByIdAndDelete(userId);
  if (existingUser?.avatarPublicId) {
    await deleteCloudinaryAsset(existingUser.avatarPublicId);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
