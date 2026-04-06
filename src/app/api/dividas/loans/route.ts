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
      SELECT id, institution_name, name, total_amount::float, installment_amount::float,
             total_installments, paid_installments, outstanding_balance::float, interest_rate::float, updated_at
      FROM loans WHERE user_id = ${userId} ORDER BY outstanding_balance DESC`;

    const totalDevedor = loans.reduce((s, l) => s + (Number(l.outstanding_balance) || 0), 0);

    return NextResponse.json({ loans, totalDevedor, count: loans.length });
  } catch {
    return NextResponse.json({ loans: [], totalDevedor: 0, count: 0 });
  }
}
