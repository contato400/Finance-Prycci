import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseSelect } from "@/lib/supabase/rest";

// Retorna dados agregados para o dashboard
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Buscar tudo em paralelo
    const [itemsRes, accountsRes, cardsRes, investmentsRes, txRes, pluggyItemsRes] = await Promise.all([
      supabaseSelect("pluggy_items", { select: "id" }),
      supabaseSelect<{ id: string; item_id: string; type: string; balance: number }>(
        "accounts", { select: "id,item_id,name,type,balance" }
      ),
      supabaseSelect<{ id: string; account_id: string; balance: number; credit_limit: number }>(
        "credit_cards", { select: "id,account_id,balance,credit_limit,available_limit" }
      ),
      supabaseSelect<{ balance: number }>("investments", { select: "balance" }),
      supabaseSelect<{ date: string; amount: number }>(
        "transactions", { select: "date,amount", filter: `date=gte.${thirtyDaysAgo}`, order: "date.asc" }
      ),
      supabaseSelect<{ id: string; institution_name: string }>(
        "pluggy_items", { select: "id,institution_name" }
      ),
    ]);

    const accounts = accountsRes.data || [];
    const creditCards = cardsRes.data || [];
    const investments = investmentsRes.data || [];
    const transactions = txRes.data || [];
    const pluggyItems = pluggyItemsRes.data || [];

    // Mapa de item_id → institution_name
    const instMap = new Map<string, string>();
    for (const pi of pluggyItems) instMap.set(pi.id, pi.institution_name);

    // Mapa de account_id → item_id
    const acctItemMap = new Map<string, string>();
    for (const a of accounts) acctItemMap.set(a.id, a.item_id);

    // Métricas
    const bankAccounts = accounts.filter(
      (a) => a.type === "CHECKING_ACCOUNT" || a.type === "SAVINGS_ACCOUNT" || a.type === "BANK"
    );
    const totalBalance = bankAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const totalCreditUsed = creditCards.reduce((sum, c) => sum + Number(c.balance), 0);
    const totalCreditLimit = creditCards.reduce((sum, c) => sum + Number(c.credit_limit), 0);
    const totalInvested = investments.reduce((sum, i) => sum + Number(i.balance), 0);
    const netBalance = totalBalance - totalCreditUsed;

    // Agrupar por instituição
    const institutionData = new Map<string, { name: string; balance: number; creditLimit: number; creditUsed: number }>();

    for (const account of bankAccounts) {
      const instName = instMap.get(account.item_id) || "Desconhecido";
      const existing = institutionData.get(instName) || { name: instName, balance: 0, creditLimit: 0, creditUsed: 0 };
      existing.balance += Number(account.balance);
      institutionData.set(instName, existing);
    }

    for (const card of creditCards) {
      const itemId = acctItemMap.get(card.account_id) || "";
      const instName = instMap.get(itemId) || "Desconhecido";
      const existing = institutionData.get(instName) || { name: instName, balance: 0, creditLimit: 0, creditUsed: 0 };
      existing.creditLimit += Number(card.credit_limit);
      existing.creditUsed += Number(card.balance);
      institutionData.set(instName, existing);
    }

    const institutions = Array.from(institutionData.values());

    // Evolução do saldo (últimos 30 dias)
    const balanceHistory: { date: string; balance: number }[] = [];
    const txByDay = new Map<string, number>();
    for (const tx of transactions) {
      txByDay.set(tx.date, (txByDay.get(tx.date) || 0) + Number(tx.amount));
    }

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayDelta = txByDay.get(dateStr) || 0;
      balanceHistory.push({
        date: dateStr,
        balance: Math.round((totalBalance - dayDelta * (i / 10)) * 100) / 100,
      });
    }

    return NextResponse.json({
      totalBalance,
      totalCreditUsed,
      totalCreditLimit,
      totalInvested,
      netBalance,
      institutions,
      balanceHistory,
      connectedBanks: itemsRes.data?.length || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
