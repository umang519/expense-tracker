import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getYearlySummary } from "@/lib/data/summary";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");

  if (!yearParam || !/^\d{4}$/.test(yearParam)) {
    return NextResponse.json({ error: "year param required (YYYY)" }, { status: 400 });
  }

  const summary = await getYearlySummary(auth.userId, Number(yearParam));
  return NextResponse.json(summary);
}
