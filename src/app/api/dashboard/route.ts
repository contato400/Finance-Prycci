import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

// Retorna dados agregados para o dashboard
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = createSupabaseServer();

    // Buscar tudo em paralelo
    const [
      { data: items },
      { data: accounts },
      { data: creditCards },
      { data: investments },
      { data: transactions },
    ] = await Promise.all([
      supabase.from("pluggy_items").select("*"),
      supabase.from("accounts").select("*, pluggy_items(institution_name)"),
      supabase.from("credit_cards").select("*, accounts(pluggy_account_id, pluggy_items(institution_name))"),
      supabase.from("investments").select("*"),
      supabase
        .from("transactions")
        .select("*")
        .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        .order("date", { ascending: true }),
    ]);

    // Calcular métricas
    const bankAccounts = (accounts || []).filter(
      (a) => a.type === "CHECKING_ACCOUNT" || a.type === "SAVINGS_ACCOUNT" || a.type === "BANK"
    );
    const totalBalance = bankAccounts.reduce((sum, a) => sum + Number(a.balance), 0);

    const totalCreditUsed = (creditCards || []).reduce((sum, c) => sum + Number(c.balance), 0);
    const totalCreditLimit = (creditCards || []).reduce((sum, c) => sum + Number(c.credit_limit), 0);

    const totalInvested = (investments || []).reduce((sum, i) => sum + Number(i.balance), 0);

    const netBalance = totalBalance - totalCreditUsed;

    // Agrupar contas por instituição
    const institutionMap = new Map<string, {
      name: string;
      balance: number;
      creditLimit: number;
      creditUsed: number;
    }>();

    for (const account of bankAccounts) {
      const instName = account.pluggy_items?.institution_name || "Desconhecido";
      const existing = institutionMap.get(instName) || {
        name: instName,
        balance: 0,
        creditLimit: 0,
        creditUsed: 0,
      };
      existing.balance += Number(account.balance);
      institutionMap.set(instName, existing);
    }

    for (const card of creditCards || []) {
      const instName = card.accounts?.pluggy_items?.institution_name || "Desconhecido";
      const existing = institutionMap.get(instName) || {
        name: instName,
        balance: 0,
        creditLimit: 0,
        creditUsed: 0,
      };
      existing.creditLimit += Number(card.credit_limit);
      existing.creditUsed += Number(card.balance);
      institutionMap.set(instName, existing);
    }

    const institutions = Array.from(institutionMap.values());

    // Evolução de saldo dos últimos 30 dias (agrupado por dia)
    const balanceHistory: { date: string; balance: number }[] = [];
    const runningBalance = totalBalance;

    // Criar mapa de transações por dia
    const txByDay = new Map<string, number>();
    for (const tx of transactions || []) {
      const day = tx.date;
      txByDay.set(day, (txByDay.get(day) || 0) + Number(tx.amount));
    }

    // Gerar últimos 30 dias
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayDelta = txByDay.get(dateStr) || 0;
      // Simular evolução: saldo atual menos transações futuras
      balanceHistory.push({
        date: dateStr,
        balance: Math.round((runningBalance - dayDelta * (i / 10)) * 100) / 100,
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
      connectedBanks: items?.length || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
