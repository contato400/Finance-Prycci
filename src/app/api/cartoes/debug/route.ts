import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Debug endpoint — mostra dados brutos de cartões e contas da Caixa
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // 1. Todos os cartões de crédito com dados brutos
    const creditCards = await sql`
      SELECT a.name, a.type, a.balance::float as balance,
             COALESCE(a.credit_limit, 0)::float as credit_limit,
             ABS(a.balance)::float as usado,
             (COALESCE(a.credit_limit, 0) - ABS(a.balance))::float as disponivel,
             pi.institution_name, pi.item_id
      FROM accounts a
      JOIN pluggy_items pi ON a.item_id = pi.id
      WHERE a.type IN ('CREDIT_CARD', 'CREDIT')
      ORDER BY a.name`;

    // 2. Contas que contenham 'caixa' ou 'sim' (qualquer tipo)
    const caixaAccounts = await sql`
      SELECT a.name, a.type, a.balance::float as balance,
             COALESCE(a.credit_limit, 0)::float as credit_limit,
             pi.institution_name
      FROM accounts a
      JOIN pluggy_items pi ON a.item_id = pi.id
      WHERE a.name ILIKE '%caixa%' OR a.name ILIKE '%sim%'
      ORDER BY a.name`;

    return NextResponse.json({
      message: "Dados brutos para diagnóstico",
      creditCards,
      caixaAccounts,
      totalCreditCards: creditCards.length,
      totalCaixaAccounts: caixaAccounts.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
