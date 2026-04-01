import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const [row] = await sql`
      SELECT COUNT(*)::int AS count FROM pluggy_items WHERE user_id = ${userId}`;

    return NextResponse.json({ count: row?.count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
