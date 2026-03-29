import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseSelect } from "@/lib/supabase/rest";

// Retorna contas com filtro, transações paginadas e gastos por categoria
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

    // Buscar contas
    let accountFilter = "type=in.(CHECKING_ACCOUNT,SAVINGS_ACCOUNT,BANK)";
    if (typeFilter) accountFilter = `type=eq.${typeFilter}`;

    const { data: accounts } = await supabaseSelect<{
      id: string; item_id: string; pluggy_account_id: string;
      name: string; type: string; balance: number; currency: string; updated_at: string;
    }>("accounts", { select: "*", filter: accountFilter, order: "updated_at.desc" });

    // Enriquecer com institution_name
    const itemIds = Array.from(new Set((accounts || []).map((a) => a.item_id)));
    const instMap = new Map<string, string>();
    if (itemIds.length > 0) {
      const { data: items } = await supabaseSelect<{ id: string; institution_name: string }>(
        "pluggy_items", { select: "id,institution_name", filter: `id=in.(${itemIds.join(",")})` }
      );
      for (const item of items || []) instMap.set(item.id, item.institution_name);
    }

    const enrichedAccounts = (accounts || []).map((a) => ({
      ...a,
      pluggy_items: { institution_name: instMap.get(a.item_id) || "—" },
    }));

    // Transações paginadas
    let transactions = null;
    let totalTransactions = 0;

    if (accountId) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

      const { count } = await supabaseSelect("transactions", {
        select: "id",
        filter: `account_id=eq.${accountId}&date=gte.${fromDate}`,
        count: true,
        limit: 0,
      });
      totalTransactions = count || 0;

      const offset = (page - 1) * pageSize;
      const { data: txData } = await supabaseSelect("transactions", {
        select: "*",
        filter: `account_id=eq.${accountId}&date=gte.${fromDate}&offset=${offset}`,
        order: "date.desc",
        limit: pageSize,
      });
      transactions = txData;
    }

    // Gastos por categoria (últimos 30 dias, débitos)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const accountIds = (accounts || []).map((a) => a.id);

    let categoryData: Array<{ category: string; total: number }> = [];
    if (accountIds.length > 0) {
      const { data: allTx } = await supabaseSelect<{
        category: string | null; amount: number; type: string;
      }>("transactions", {
        select: "category,amount,type",
        filter: `account_id=in.(${accountIds.join(",")})&type=eq.DEBIT&date=gte.${thirtyDaysAgo.toISOString().split("T")[0]}`,
      });

      const catMap = new Map<string, number>();
      for (const tx of allTx || []) {
        const cat = tx.category || "Sem categoria";
        catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(Number(tx.amount)));
      }
      categoryData = Array.from(catMap.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    }

    return NextResponse.json({
      accounts: enrichedAccounts,
      transactions,
      totalTransactions,
      page,
      pageSize,
      totalPages: Math.ceil(totalTransactions / pageSize),
      categoryData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar contas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
