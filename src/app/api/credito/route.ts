import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Retorna dados consolidados de crédito — busca de accounts type=CREDIT
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const [creditAccounts, loans, scoreRows] = await Promise.all([
      sql`SELECT a.id, a.balance, a.credit_limit, a.name, p.institution_name
          FROM accounts a
          JOIN pluggy_items p ON a.item_id = p.id
          WHERE a.type IN ('CREDIT', 'CREDIT_CARD')
          ORDER BY a.updated_at DESC`,
      sql`SELECT * FROM loans ORDER BY updated_at DESC`,
      sql`SELECT * FROM credit_score ORDER BY updated_at DESC LIMIT 1`,
    ]);

    // Métricas de crédito direto da tabela accounts
    const totalLimit = creditAccounts.reduce((s, c) => s + Number(c.credit_limit || 0), 0);
    const totalUsed = creditAccounts.reduce((s, c) => s + Math.abs(Number(c.balance)), 0);
    const totalAvailable = Math.max(totalLimit - totalUsed, 0);
    const creditCompromised = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

    // Limites por banco
    const bankMap = new Map<string, { limit: number; used: number; available: number }>();
    for (const c of creditAccounts) {
      const inst = c.institution_name || "Desconhecido";
      const used = Math.abs(Number(c.balance));
      const limit = Number(c.credit_limit || 0);
      const e = bankMap.get(inst) || { limit: 0, used: 0, available: 0 };
      e.limit += limit;
      e.used += used;
      e.available += Math.max(limit - used, 0);
      bankMap.set(inst, e);
    }

    const limitsByBank: Array<{ institution: string; limit: number; used: number; available: number }> = [];
    bankMap.forEach((val, institution) => { limitsByBank.push({ institution, ...val }); });

    const totalLoanDebt = loans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

    return NextResponse.json({
      totalLimit, totalUsed, totalAvailable, creditCompromised,
      limitsByBank,
      loans: loans.map((l) => ({ ...l, institution_name: l.institution_name || "Desconhecido" })),
      totalLoanDebt, score: scoreRows[0] || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar crédito";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
