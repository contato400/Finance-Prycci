import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { translateCategory } from "@/lib/categories";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Retorna contas bancárias (não cartões de crédito), transações e gastos por categoria
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type");
    const accountId = searchParams.get("accountId");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = 20;

    // Buscar contas — filtro exclui cartões de crédito por padrão
    // Se typeFilter = "ALL", mostra tudo exceto CREDIT
    // Se typeFilter é específico (CHECKING_ACCOUNT, SAVINGS_ACCOUNT), filtra
    const accounts = typeFilter
      ? await sql`
          SELECT a.*, p.institution_name FROM accounts a
          JOIN pluggy_items p ON a.item_id = p.id
          WHERE a.type = ${typeFilter}
          ORDER BY a.updated_at DESC`
      : await sql`
          SELECT a.*, p.institution_name FROM accounts a
          JOIN pluggy_items p ON a.item_id = p.id
          WHERE a.type NOT IN ('CREDIT', 'CREDIT_CARD')
          ORDER BY a.updated_at DESC`;

    const enriched = accounts.map((a) => ({
      ...a,
      pluggy_items: { institution_name: a.institution_name || "Desconhecido" },
    }));

    // Transações paginadas
    let transactions = null;
    let totalTransactions = 0;

    if (accountId) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

      const [{ total }] = await sql`
        SELECT count(*) as total FROM transactions
        WHERE account_id = ${accountId}::uuid AND date >= ${fromDate}`;
      totalTransactions = Number(total);

      const offset = (page - 1) * pageSize;
      const rawTx = await sql`
        SELECT * FROM transactions
        WHERE account_id = ${accountId}::uuid AND date >= ${fromDate}
        ORDER BY date DESC LIMIT ${pageSize} OFFSET ${offset}`;
      transactions = rawTx.map((tx) => ({ ...tx, category: translateCategory(tx.category) }));
    }

    // Gastos por categoria (últimos 30 dias, débitos)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fromDate30 = thirtyDaysAgo.toISOString().split("T")[0];
    const accountIds = accounts.map((a) => a.id);

    let categoryData: Array<{ category: string; total: number }> = [];
    if (accountIds.length > 0) {
      const catRows = await sql`
        SELECT COALESCE(category, 'Sem categoria') as category, SUM(ABS(amount)) as total
        FROM transactions
        WHERE account_id = ANY(${accountIds}::uuid[]) AND type = 'DEBIT' AND date >= ${fromDate30}
        GROUP BY COALESCE(category, 'Sem categoria')
        ORDER BY total DESC LIMIT 10`;
      categoryData = catRows.map((r) => ({ category: translateCategory(r.category), total: Number(r.total) }));
    }

    return NextResponse.json({
      accounts: enriched, transactions, totalTransactions,
      page, pageSize, totalPages: Math.ceil(totalTransactions / pageSize), categoryData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar contas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
