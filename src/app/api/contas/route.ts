import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { translateCategory } from "@/lib/categories";
import { translateInstitution } from "@/lib/institutions";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Retorna contas bancárias (excluindo cartões), transações e categorias
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type");
    const accountId = searchParams.get("accountId");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = 20;

    const now = new Date();
    const start = searchParams.get("start") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = searchParams.get("end") ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const accounts = typeFilter
      ? await sql`
          SELECT a.*, a.balance::float as balance, p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id
          WHERE a.user_id = ${userId} AND a.type = ${typeFilter}
          ORDER BY a.updated_at DESC`
      : await sql`
          SELECT a.*, a.balance::float as balance, p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id
          WHERE a.user_id = ${userId} AND a.type NOT IN ('CREDIT', 'CREDIT_CARD')
          ORDER BY a.updated_at DESC`;

    const enriched = accounts.map((a) => ({
      ...a,
      pluggy_items: { institution_name: translateInstitution(a.institution_name) },
    }));

    let transactions = null;
    let totalTransactions = 0;

    if (accountId) {
      const [{ total }] = await sql`
        SELECT count(*)::int as total FROM transactions
        WHERE account_id = ${accountId}::uuid AND user_id = ${userId} AND date >= ${start} AND date <= ${end}`;
      totalTransactions = Number(total) || 0;

      const offset = (page - 1) * pageSize;
      const rawTx = await sql`
        SELECT *, amount::float as amount FROM transactions
        WHERE account_id = ${accountId}::uuid AND user_id = ${userId} AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC LIMIT ${pageSize} OFFSET ${offset}`;
      transactions = rawTx.map((tx) => ({ ...tx, category: translateCategory(tx.category) }));
    }

    const accountIds = accounts.map((a) => a.id);

    let categoryData: Array<{ category: string; total: number }> = [];
    let topTransfers: Array<{ destinatario: string; total: number; qtd: number }> = [];
    if (accountIds.length > 0) {
      const [catRows, transferRows] = await Promise.all([
        sql`
          SELECT categoria_real as category, SUM(ABS(amount))::float as total
          FROM (
            SELECT amount, category, description,
              CASE
                WHEN description ILIKE '%pix%' AND amount < 0 THEN
                  'Pix: ' || TRIM(REGEXP_REPLACE(
                    REGEXP_REPLACE(description, '(?i)pix enviado\\|?\\s*', ''),
                    '(?i)transferência enviada\\|?\\s*', ''
                  ))
                WHEN (description ILIKE '%ted%' OR description ILIKE '%doc%') AND amount < 0 THEN
                  'TED: ' || TRIM(SPLIT_PART(description, '|', 2))
                WHEN description ILIKE '%transferência enviada%' AND description LIKE '%|%' THEN
                  'Transf: ' || TRIM(SPLIT_PART(description, '|', 2))
                WHEN description ILIKE '%boleto%' OR description ILIKE '%slip%'
                  OR description ILIKE '%pgto%' OR description ILIKE '%pagamento%' THEN
                  'Boleto / Pagamento'
                WHEN description ILIKE '%fatura%' OR description ILIKE '%cartao%'
                  OR description ILIKE '%cartão%' THEN
                  'Pagamento de cartão'
                WHEN category ILIKE '%invest%' OR description ILIKE '%aplicacao%'
                  OR description ILIKE '%cdb%' OR description ILIKE '%tesouro%' THEN
                  'Aporte / Aplicação'
                ELSE COALESCE(category, 'Outros')
              END AS categoria_real
            FROM transactions
            WHERE account_id = ANY(${accountIds}::uuid[])
              AND user_id = ${userId}
              AND amount < 0
              AND date >= ${start} AND date <= ${end}
          ) sub
          GROUP BY categoria_real
          ORDER BY total DESC`,
        sql`
          SELECT
            REGEXP_REPLACE(description,
              '^(Transferência enviada|Pix enviado|TED|DOC)\\|?\\s*', '', 'i') AS destinatario,
            SUM(ABS(amount))::float AS total,
            COUNT(*)::int AS qtd
          FROM transactions
          WHERE account_id = ANY(${accountIds}::uuid[])
            AND user_id = ${userId}
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

      const allCategories = catRows.map((r) => ({
        category: translateCategory(r.category),
        total: Number(r.total) || 0,
      }));

      if (allCategories.length > 8) {
        const top8 = allCategories.slice(0, 8);
        const restCount = allCategories.length - 8;
        const restTotal = allCategories.slice(8).reduce((s, c) => s + c.total, 0);
        top8.push({ category: `Outros (${restCount} categorias)`, total: restTotal });
        categoryData = top8;
      } else {
        categoryData = allCategories;
      }
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
