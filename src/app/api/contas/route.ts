import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

// Retorna todas as contas agrupadas por banco, com transações recentes
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type"); // CHECKING_ACCOUNT, SAVINGS_ACCOUNT, ou null (todas)
    const accountId = searchParams.get("accountId"); // Para buscar transações de uma conta
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = 20;

    const supabase = createSupabaseServer();

    // Buscar contas (filtradas por tipo se necessário)
    let accountsQuery = supabase
      .from("accounts")
      .select("*, pluggy_items(institution_name)")
      .in("type", ["CHECKING_ACCOUNT", "SAVINGS_ACCOUNT", "BANK"]);

    if (typeFilter) {
      accountsQuery = supabase
        .from("accounts")
        .select("*, pluggy_items(institution_name)")
        .eq("type", typeFilter);
    }

    const { data: accounts } = await accountsQuery.order("updated_at", { ascending: false });

    // Buscar transações se um accountId for especificado
    let transactions = null;
    let totalTransactions = 0;

    if (accountId) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("account_id", accountId)
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

      totalTransactions = count || 0;

      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .eq("account_id", accountId)
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("date", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      transactions = txData;
    }

    // Buscar gastos por categoria (últimos 30 dias, todas as contas bancárias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const accountIds = (accounts || []).map((a) => a.id);

    let categoryData: Array<{ category: string; total: number }> = [];

    if (accountIds.length > 0) {
      const { data: allTx } = await supabase
        .from("transactions")
        .select("category, amount, type")
        .in("account_id", accountIds)
        .eq("type", "DEBIT")
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

      // Agrupar por categoria
      const categoryMap = new Map<string, number>();
      for (const tx of allTx || []) {
        const cat = tx.category || "Sem categoria";
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + Math.abs(Number(tx.amount)));
      }

      categoryData = Array.from(categoryMap.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10); // Top 10 categorias
    }

    return NextResponse.json({
      accounts: accounts || [],
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
