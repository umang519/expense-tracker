import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getAdminStats } from "@/lib/data/admin";

// proxy.ts's matcher only covers pages, not /api/**, so this route needs its
// own independent role check — can't rely on the edge redirect alone.
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const stats = await getAdminStats();
  return NextResponse.json(stats);
}
