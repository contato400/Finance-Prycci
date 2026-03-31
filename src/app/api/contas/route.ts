import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { translateCategory } from "@/lib/categories";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Retorna contas bancárias (excluindo cartões), transações e categorias
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

    // Período: default = mês atual
    const now = new Date();
    const start = searchParams.get("start") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = searchParams.get("end") ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Contas bancárias — exclui CREDIT/CREDIT_CARD (esses vão para /cartoes)
    const accounts = typeFilter
      ? await sql`
          SELECT a.*, a.balance::float as balance, p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id
          WHERE a.type = ${typeFilter}
          ORDER BY a.updated_at DESC`
      : await sql`
          SELECT a.*, a.balance::float as balance, p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id
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
      const [{ total }] = await sql`
        SELECT count(*)::int as total FROM transactions
        WHERE account_id = ${accountId}::uuid AND date >= ${start} AND date <= ${end}`;
      totalTransactions = Number(total) || 0;

      const offset = (page - 1) * pageSize;
      const rawTx = await sql`
        SELECT *, amount::float as amount FROM transactions
        WHERE account_id = ${accountId}::uuid AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC LIMIT ${pageSize} OFFSET ${offset}`;
      transactions = rawTx.map((tx) => ({ ...tx, category: translateCategory(tx.category) }));
    }

    // Gastos por categoria no período
    const accountIds = accounts.map((a) => a.id);

    let categoryData: Array<{ category: string; total: number }> = [];
    let topTransfers: Array<{ destinatario: string; total: number; qtd: number }> = [];
    if (accountIds.length > 0) {
      const [catRows, transferRows] = await Promise.all([
        sql`
          SELECT effective_category as category, SUM(ABS(amount))::float as total
          FROM (
            SELECT amount,
              CASE
                WHEN description ILIKE '%pix%' THEN 'Pix enviado'
                WHEN description ILIKE '%ted%' THEN 'TED'
                WHEN description ILIKE '%boleto%' OR description ILIKE '%slip%' THEN 'Boleto'
                ELSE COALESCE(category, 'Sem categoria')
              END AS effective_category
            FROM transactions
            WHERE account_id = ANY(${accountIds}::uuid[]) AND type = 'DEBIT'
              AND date >= ${start} AND date <= ${end}
          ) sub
          GROUP BY effective_category
          ORDER BY total DESC LIMIT 10`,
        sql`
          SELECT
            REGEXP_REPLACE(description,
              '^(Transferência enviada|Pix enviado|TED|DOC)\\|?\\s*', '', 'i') AS destinatario,
            SUM(ABS(amount))::float AS total,
            COUNT(*)::int AS qtd
          FROM transactions
          WHERE account_id = ANY(${accountIds}::uuid[])
            AND amount < 0
            AND (
              description ILIKE '%transferência%' OR
              description ILIKE '%pix%' OR
              description ILIKE '%ted%' OR
              description ILIKE '%doc%'
            )
            AND date >= ${start} AND date <= ${end}
          GROUP BY destinatario
          ORDER BY total DESC
          LIMIT 5`,
      ]);
      categoryData = catRows.map((r) => ({
        category: translateCategory(r.category),
        total: Number(r.total) || 0,
      }));
      topTransfers = transferRows.map((r) => ({
        destinatario: r.destinatario || "Desconhecido",
        total: Number(r.total) || 0,
        qtd: Number(r.qtd) || 0,
      }));
    }

    return NextResponse.json({
      accounts: enriched, transactions, totalTransactions,
      page, pageSize, totalPages: Math.ceil(totalTransactions / pageSize), categoryData, topTransfers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar contas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
