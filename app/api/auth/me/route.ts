import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest, COOKIE_NAME } from "@/lib/auth";
import { UpdateProfileSchema } from "@/lib/validation";
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

  await connectDB();

  const user = await User.findByIdAndUpdate(
    auth.userId,
    { $set: parsed.data },
    { new: true }
  ).select("-passwordHash");

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      currency: user.currency,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const userId = auth.userId;
  await Promise.all([
    Expense.deleteMany({ userId }),
    Category.deleteMany({ userId }),
    Transaction.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    RecurringExpense.deleteMany({ userId }),
    PushSubscription.deleteMany({ userId }),
  ]);
  await User.findByIdAndDelete(userId);

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
