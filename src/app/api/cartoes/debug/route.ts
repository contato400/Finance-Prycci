import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Debug endpoint — mostra dados brutos para diagnóstico
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // 1. Todas as conexões + contas (visão completa)
    const allItemsAndAccounts = await sql`
      SELECT
        pi.item_id AS pluggy_item_id,
        pi.institution_name,
        pi.status,
        a.name AS conta,
        a.type,
        a.balance::float AS balance,
        COALESCE(a.credit_limit, 0)::float AS credit_limit
      FROM pluggy_items pi
      LEFT JOIN accounts a ON a.item_id = pi.id
      ORDER BY pi.institution_name, a.type`;

    // 2. Só cartões de crédito com cálculos
    const creditCards = await sql`
      SELECT a.name, a.type, a.balance::float AS balance,
             COALESCE(a.credit_limit, 0)::float AS credit_limit,
             ABS(a.balance)::float AS usado,
             (COALESCE(a.credit_limit, 0) - ABS(a.balance))::float AS disponivel,
             pi.institution_name, pi.item_id AS pluggy_item_id
      FROM accounts a
      JOIN pluggy_items pi ON a.item_id = pi.id
      WHERE a.type IN ('CREDIT_CARD', 'CREDIT')
      ORDER BY a.name`;

    // 3. Contas que contenham 'caixa' ou 'sim' (qualquer tipo)
    const caixaAccounts = await sql`
      SELECT a.name, a.type, a.balance::float AS balance,
             COALESCE(a.credit_limit, 0)::float AS credit_limit,
             pi.institution_name
      FROM accounts a
      JOIN pluggy_items pi ON a.item_id = pi.id
      WHERE a.name ILIKE '%caixa%' OR a.name ILIKE '%sim%'
      ORDER BY a.name`;

    // 4. Investimentos
    const investments = await sql`
      SELECT name, type, balance::float AS balance,
             COALESCE(value, 0)::float AS value,
             COALESCE(quantity, 0)::float AS quantity
      FROM investments
      ORDER BY balance DESC`;

    // 5. Colunas reais da tabela investments
    const investmentColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'investments'
      ORDER BY ordinal_position`;

    return NextResponse.json({
      message: "Dados brutos para diagnóstico",
      allItemsAndAccounts,
      creditCards,
      caixaAccounts,
      investments,
      investmentColumns: investmentColumns.map((c) => `${c.column_name} (${c.data_type})`),
      totals: {
        items: allItemsAndAccounts.length,
        creditCards: creditCards.length,
        caixaAccounts: caixaAccounts.length,
        investments: investments.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
