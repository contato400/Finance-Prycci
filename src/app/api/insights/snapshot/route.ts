import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    const [incomeRow, expenseRow, balanceRow, creditRow, investRow, categoriesRows] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount > 0 AND date >= DATE_TRUNC('month', NOW()) AND date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'`,
      sql`SELECT COALESCE(SUM(ABS(amount)), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= DATE_TRUNC('month', NOW()) AND date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'`,
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM accounts WHERE user_id = ${userId} AND type NOT IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(ABS(balance)), 0)::float AS used, COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS lim FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(i.balance), 0)::float AS total FROM investments i JOIN pluggy_items pi ON i.item_id = pi.id WHERE pi.user_id = ${userId}`,
      sql`SELECT COALESCE(category, 'Outros') AS category, SUM(ABS(amount))::float AS total FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= DATE_TRUNC('month', NOW()) GROUP BY category ORDER BY total DESC LIMIT 10`,
    ]);

    const receita = num(incomeRow[0]?.total);
    const gastos = num(expenseRow[0]?.total);
    const saldo = num(balanceRow[0]?.total);
    const creditoUsado = num(creditRow[0]?.used);
    const creditoLimite = num(creditRow[0]?.lim);
    const investido = num(investRow[0]?.total);

    const gastosPorCategoria = Object.fromEntries(
      categoriesRows.map((c) => [String(c.category), num(c.total)])
    );

    // Score simples baseado em comprometimento
    const ratio = receita > 0 ? gastos / receita : 1;
    const scoreSaude = ratio < 0.5 ? 9 : ratio < 0.7 ? 7 : ratio < 0.85 ? 5 : ratio <= 1 ? 3 : 1;

    await sql`
      INSERT INTO financial_snapshots (user_id, month, receita, gastos, saldo, credito_usado, credito_limite, investido, score_saude, gastos_por_categoria)
      VALUES (${userId}, ${month}, ${receita}, ${gastos}, ${saldo}, ${creditoUsado}, ${creditoLimite}, ${investido}, ${scoreSaude}, ${JSON.stringify(gastosPorCategoria)}::jsonb)
      ON CONFLICT (user_id, month) DO UPDATE SET
        receita = EXCLUDED.receita, gastos = EXCLUDED.gastos, saldo = EXCLUDED.saldo,
        credito_usado = EXCLUDED.credito_usado, credito_limite = EXCLUDED.credito_limite,
        investido = EXCLUDED.investido, score_saude = EXCLUDED.score_saude,
        gastos_por_categoria = EXCLUDED.gastos_por_categoria, created_at = NOW()
    `;

    return NextResponse.json({ saved: true, month, receita, gastos, saldo, scoreSaude });
  } catch (error) {
    console.error("Snapshot error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 });
  }
}
