import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const bills = await sql`
      SELECT id, institution_name, description, amount::float, due_date::text, status, bar_code
      FROM bills WHERE user_id = ${userId} ORDER BY due_date ASC`;

    const today = new Date().toISOString().split("T")[0];
    const pendentes = bills.filter((b) => b.status !== "PAID");
    const vencidos = pendentes.filter((b) => b.due_date && b.due_date < today);
    const totalAberto = pendentes.reduce((s, b) => s + (Number(b.amount) || 0), 0);

    return NextResponse.json({ bills, totalAberto, pendentes: pendentes.length, vencidos: vencidos.length });
  } catch {
    return NextResponse.json({ bills: [], totalAberto: 0, pendentes: 0, vencidos: 0 });
  }
}
