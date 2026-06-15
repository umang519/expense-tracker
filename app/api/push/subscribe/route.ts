import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import { z } from "zod";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  await connectDB();
  await PushSubscription.findOneAndUpdate(
    { endpoint: parsed.data.endpoint },
    { userId: user.userId, endpoint: parsed.data.endpoint, keys: parsed.data.keys },
    { upsert: true }
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  await connectDB();
  await PushSubscription.deleteOne({ userId: user.userId, endpoint });

  return NextResponse.json({ ok: true });
}
