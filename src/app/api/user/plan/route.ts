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
      SELECT plan, status, expires_at
      FROM user_plans
      WHERE user_id = ${userId} AND status = 'active'
      LIMIT 1`;

    if (rows.length === 0) {
      // Cria plano free para novos usuários
      await sql`
        INSERT INTO user_plans (user_id, plan, status)
        VALUES (${userId}, 'free', 'active')
        ON CONFLICT (user_id) DO NOTHING`;
      return NextResponse.json({ plan: "free", status: "active" });
    }

    const row = rows[0];
    // Verificar se expirou
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await sql`UPDATE user_plans SET plan = 'free', status = 'active', expires_at = NULL WHERE user_id = ${userId}`;
      return NextResponse.json({ plan: "free", status: "active" });
    }

    return NextResponse.json({ plan: row.plan, status: row.status });
  } catch (error) {
    return NextResponse.json({ plan: "free", status: "active" }); // fallback seguro
  }
}
