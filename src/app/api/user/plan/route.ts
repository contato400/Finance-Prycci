import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const rows = await sql`
      SELECT plan, status FROM user_plans
      WHERE user_id = ${userId} AND status = 'active'
      LIMIT 1`;

    if (rows.length === 0) {
      await sql`
        INSERT INTO user_plans (user_id, plan, status)
        VALUES (${userId}, 'free', 'active')
        ON CONFLICT (user_id) DO NOTHING`;
      return NextResponse.json({ plan: "free", status: "active" });
    }

    return NextResponse.json({ plan: rows[0].plan, status: rows[0].status });
  } catch {
    return NextResponse.json({ plan: "free", status: "active" });
  }
}
