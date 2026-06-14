import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { RecurringExpenseUpdateSchema } from "@/lib/validation";
import RecurringExpense from "@/models/RecurringExpense";
import { Types } from "mongoose";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = RecurringExpenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  await connectDB();

  const update: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.startDate) {
    const [y, m, d] = parsed.data.startDate.split("-").map(Number);
    update.startDate = new Date(Date.UTC(y, m - 1, d));
    update.lastGeneratedDate = null;
  }

  if ("endDate" in parsed.data) {
    if (parsed.data.endDate) {
      const [ey, em, ed] = parsed.data.endDate.split("-").map(Number);
      update.endDate = new Date(Date.UTC(ey, em - 1, ed));
    } else {
      update.endDate = null;
    }
  }

  const entry = await RecurringExpense.findOneAndUpdate(
    { _id: id, userId: auth.userId },
    { $set: update },
    { new: true }
  ).populate("categoryId", "name color");

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ recurring: entry });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();

  const entry = await RecurringExpense.findOneAndDelete({ _id: id, userId: auth.userId });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
