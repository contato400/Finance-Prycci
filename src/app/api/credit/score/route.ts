import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const [incomeRow, expenseRow, creditRow, investRow, banksRow, monthsRow] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount > 0 AND date >= NOW() - INTERVAL '30 days'`,
      sql`SELECT COALESCE(SUM(ABS(amount)), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= NOW() - INTERVAL '30 days'`,
      sql`SELECT COALESCE(SUM(ABS(balance)), 0)::float AS used, COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS lim FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM investments WHERE user_id = ${userId}`,
      sql`SELECT COUNT(DISTINCT institution_name)::int AS total FROM pluggy_items WHERE user_id = ${userId}`,
      sql`SELECT COUNT(DISTINCT DATE_TRUNC('month', date))::int AS meses FROM transactions WHERE user_id = ${userId} AND amount > 0 AND date >= NOW() - INTERVAL '90 days'`,
    ]);

    const receita = num(incomeRow[0]?.total);
    const gastos = num(expenseRow[0]?.total);
    const creditUsed = num(creditRow[0]?.used);
    const creditLimit = num(creditRow[0]?.lim);
    const investido = num(investRow[0]?.total);
    const numBancos = num(banksRow[0]?.total);
    const mesesComReceita = num(monthsRow[0]?.meses);

    // 1. Renda (0-200)
    const renda = receita > 10000 ? 200 : receita > 5000 ? 150 : receita > 2000 ? 100 : 50;

    // 2. Comprometimento (0-200)
    const ratio = receita > 0 ? gastos / receita : 1;
    const comprometimento = ratio < 0.5 ? 200 : ratio < 0.7 ? 150 : ratio < 0.85 ? 100 : ratio <= 1 ? 50 : 0;

    // 3. Crédito (0-200)
    const creditRatio = creditLimit > 0 ? creditUsed / creditLimit : 0;
    const credito = creditLimit === 0 ? 100 : creditRatio < 0.3 ? 200 : creditRatio < 0.5 ? 150 : creditRatio < 0.7 ? 100 : creditRatio < 0.9 ? 50 : 0;

    // 4. Regularidade (0-200)
    const regularidade = Math.min(200, mesesComReceita * 67);

    // 5. Diversificação (0-200)
    let diversificacao = Math.min(100, numBancos * 50);
    if (investido > 1000) diversificacao += 100;
    else if (investido > 0) diversificacao += 50;
    diversificacao = Math.min(200, diversificacao);

    const score = Math.min(1000, renda + comprometimento + credito + regularidade + diversificacao);
    const label = score >= 700 ? "Excelente" : score >= 500 ? "Bom" : score >= 300 ? "Regular" : "Baixo";
    const color = score >= 700 ? "green" : score >= 500 ? "yellow" : score >= 300 ? "orange" : "red";

    // Capacidade de empréstimo
    const disponivelMensal = Math.max(receita - gastos, 0);
    const parcelaMaxSugerida = disponivelMensal * 0.3;

    // Salvar score
    const today = new Date().toISOString().split("T")[0];
    try {
      await sql`INSERT INTO credit_score (user_id, score, source, recorded_at, updated_at)
        VALUES (${userId}, ${score}, 'Prycci Finance', ${today}, NOW())
        ON CONFLICT ON CONSTRAINT credit_score_pkey DO NOTHING`;
    } catch { /* tabela pode não ter constraint */ }

    return NextResponse.json({
      score, label, color,
      breakdown: { renda, comprometimento, credito, regularidade, diversificacao },
      capacidade: {
        rendaMedia: receita,
        gastosMedios: gastos,
        disponivelMensal,
        parcelaMaxSugerida,
        credito12x: parcelaMaxSugerida * 12,
        credito24x: parcelaMaxSugerida * 24,
        credito36x: parcelaMaxSugerida * 36,
      },
      creditUsed, creditLimit,
    });
  } catch (error) {
    console.error("Credit score error:", error);
    return NextResponse.json({ score: 0, label: "Indisponível", color: "red", breakdown: { renda: 0, comprometimento: 0, credito: 0, regularidade: 0, diversificacao: 0 }, capacidade: { rendaMedia: 0, gastosMedios: 0, disponivelMensal: 0, parcelaMaxSugerida: 0, credito12x: 0, credito24x: 0, credito36x: 0 }, creditUsed: 0, creditLimit: 0 });
  }
}
