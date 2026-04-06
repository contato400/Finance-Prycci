import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const loans = await sql`
      SELECT l.id, l.institution_name, l.name, l.total_amount::float, l.installment_amount::float,
             l.total_installments, l.paid_installments, l.outstanding_balance::float, l.interest_rate::float, l.updated_at
      FROM loans l
      JOIN pluggy_items pi ON l.item_id = pi.id
      WHERE pi.user_id = ${userId}
      ORDER BY l.outstanding_balance DESC`;

    const totalDevedor = loans.reduce((s, l) => s + (Number(l.outstanding_balance) || 0), 0);

    return NextResponse.json({ loans, totalDevedor, count: loans.length });
  } catch {
    return NextResponse.json({ loans: [], totalDevedor: 0, count: 0 });
  }
}
