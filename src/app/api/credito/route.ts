import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cachedJson } from "@/lib/cache";
import sql from "@/lib/db";

// Retorna dados consolidados de crédito
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const [creditCards, loans, scoreRows] = await Promise.all([
      sql`SELECT cc.*, p.institution_name
          FROM credit_cards cc
          JOIN accounts a ON cc.account_id = a.id
          JOIN pluggy_items p ON a.item_id = p.id
          ORDER BY cc.updated_at DESC`,
      sql`SELECT * FROM loans ORDER BY updated_at DESC`,
      sql`SELECT * FROM credit_score ORDER BY updated_at DESC LIMIT 1`,
    ]);

    const totalLimit = creditCards.reduce((s, c) => s + Number(c.credit_limit), 0);
    const totalUsed = creditCards.reduce((s, c) => s + Number(c.balance), 0);
    const totalAvailable = creditCards.reduce((s, c) => s + Number(c.available_limit), 0);
    const creditCompromised = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

    // Limites por banco
    const bankMap = new Map<string, { limit: number; used: number; available: number }>();
    for (const c of creditCards) {
      const inst = c.institution_name || "Desconhecido";
      const e = bankMap.get(inst) || { limit: 0, used: 0, available: 0 };
      e.limit += Number(c.credit_limit);
      e.used += Number(c.balance);
      e.available += Number(c.available_limit);
      bankMap.set(inst, e);
    }

    const limitsByBank: Array<{ institution: string; limit: number; used: number; available: number }> = [];
    bankMap.forEach((val, institution) => { limitsByBank.push({ institution, ...val }); });

    const totalLoanDebt = loans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

    return cachedJson({
      totalLimit, totalUsed, totalAvailable, creditCompromised,
      limitsByBank, loans, totalLoanDebt, score: scoreRows[0] || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar crédito";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
