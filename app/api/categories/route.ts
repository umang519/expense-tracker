import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { CategoryCreateSchema } from "@/lib/validation";
import Category from "@/models/Category";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const categories = await Category.find({ userId: auth.userId }).sort({
    sortOrder: 1,
    _id: 1,
  });

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  await connectDB();

  // Place new category after the last existing one
  const lastCategory = await Category.findOne({ userId: auth.userId }).sort({
    sortOrder: -1,
  });
  const sortOrder =
    parsed.data.sortOrder ?? (lastCategory ? lastCategory.sortOrder + 1 : 0);

  const category = await Category.create({
    userId: auth.userId,
    name: parsed.data.name,
    color: parsed.data.color,
    sortOrder,
    isArchived: false,
  });

  return NextResponse.json({ category }, { status: 201 });
}
